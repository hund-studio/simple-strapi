import { createSimpleException, ensureSimpleException } from "simple-exception";
import { InferBoolean, BooleanField, BooleanOptions } from "./fields/boolean.js";
import { InferNumber, NumberField, NumberOptions } from "./fields/number.js";
import { InferText, TextField, TextOptions } from "./fields/text.js";
import { join } from "path";
import {
  InferRelationHasMany,
  InferRelationHasOne,
  RelationHasManyField,
  RelationHasManyOptions,
  RelationHasOneField,
  RelationHasOneOptions,
} from "./fields/relation.js";
import fetch, { type Response } from "node-fetch";
import http from "http";
import https from "https";
import qs from "qs";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

function agentFor(url: URL): http.Agent | https.Agent {
  return url.protocol === "https:" ? httpsAgent : httpAgent;
}

async function safeResponseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}
import z from "zod";
import { DynamicField, DynamicOptions, InferDynamic } from "./fields/dynamic.js";
import { defaultStrapiFields, schemaToParser, type StrapiDefaults } from "./utils/schema.js";
import {
  ComponentRepeatableField,
  ComponentRepeatableOptions,
  ComponentSingleField,
  ComponentSingleOptions,
  InferComponentRepeatable,
  InferComponentSingle,
} from "./fields/component.js";
import {
  InferMediaSingle,
  MediaSingleField,
  MediaSingleOptions,
  InferMediaMultiple,
  MediaMultipleField,
  MediaMultipleOptions,
  zodMediaSchema,
  ZodMediaType,
} from "./fields/media.js";
import { EnumerationField, EnumerationOptions, InferEnumeration } from "./fields/enumeration.js";
import { InferRichTextBlocks, RichTextBlocksField, RichTextBlocksOptions } from "./fields/richText.js";
import { InferJSON, JSONField, JSONOptions } from "./fields/json.js";

type RequestParams = Record<string, any>;
type EntityRequest<P = {}> = {
  where?: Record<string, string>;
  params?: RequestParams;
  headers?: Record<string, string>;
} & P;

/**
 * Cosa fare quando la risposta non combacia con lo schema dichiarato.
 *
 * `"throw"` è il default, ed è l'unico che non mente: lo schema è anche il tipo di
 * ritorno, quindi una risposta che non lo rispetta è un dato che il chiamante non può
 * usare. `"skip"` serve a chi preferisce un archivio incompleto a una pagina rotta —
 * con la collection scarta le entry non valide, con la singola restituisce `null`, e
 * in entrambi i casi lascia un avviso nei log.
 */
export type ParseErrorMode = "throw" | "skip";

/** I parametri di lettura che non fanno parte del populate. */
type ReadRequest = {
  /** Codice della locale i18n, es. `"it"`. */
  locale?: string;
  /** Versione da leggere: `"published"` è il default di Strapi. */
  status?: "draft" | "published";
};

export type SchemaField =
  | TextField
  | NumberField
  | BooleanField
  | RelationHasManyField
  | RelationHasOneField
  | DynamicField
  | ComponentSingleField
  | ComponentRepeatableField
  | MediaSingleField
  | MediaMultipleField
  | EnumerationField
  | RichTextBlocksField
  | JSONField;

export type Schema = Record<string, SchemaField>;

export type InferSchema<S extends Schema> = {
  [K in keyof S]: S[K] extends ["text", infer O extends TextOptions]
    ? InferText<O>
    : S[K] extends ["number", infer O extends NumberOptions]
      ? InferNumber<O>
      : S[K] extends ["boolean", infer O extends BooleanOptions]
        ? InferBoolean<O>
        : S[K] extends ["json", infer O extends JSONOptions]
          ? InferJSON<O>
          : S[K] extends [
                "relation.hasMany",
                infer R extends Schema,
                infer O extends RelationHasManyOptions,
              ]
            ? InferRelationHasMany<R, O>
            : S[K] extends [
                  "relation.hasOne",
                  infer R extends Schema,
                  infer O extends RelationHasOneOptions,
                ]
              ? InferRelationHasOne<R, O>
              : S[K] extends [
                    "component.single",
                    infer R extends Schema,
                    infer O extends ComponentSingleOptions,
                  ]
                ? InferComponentSingle<R, O>
                : S[K] extends [
                      "component.repeatable",
                      infer R extends Schema,
                      infer O extends ComponentRepeatableOptions,
                    ]
                  ? InferComponentRepeatable<R, O>
                  : S[K] extends [
                        "dynamic",
                        infer B extends Record<string, Schema>,
                        infer O extends DynamicOptions,
                      ]
                    ? InferDynamic<B, O>
                    : S[K] extends ["media.single", infer O extends MediaSingleOptions]
                      ? InferMediaSingle<O>
                      : S[K] extends ["media.multiple", infer O extends MediaMultipleOptions]
                        ? InferMediaMultiple<O>
                        : S[K] extends [
                              "enumeration",
                              infer V extends readonly [string, ...string[]],
                              infer O extends EnumerationOptions,
                            ]
                          ? InferEnumeration<V, O>
                          : S[K] extends ["richText.blocks", infer O extends RichTextBlocksOptions]
                            ? InferRichTextBlocks<O>
                            : never;
};

export type InferSchemaWithDefaults<S extends Schema> = InferSchema<S> & StrapiDefaults;

class Client {
  // #region STATIC
  private static headers: EntityRequest["headers"] = {
    accept: "application/json",
    "Content-Type": "application/json",
  };

  static async create(
    endpoint: string | URL,
    {
      auth,
      ...options
    }: EntityRequest<{
      auth?: { email: string; password: string } | string;
    }> = {},
  ) {
    const endpointURL = new URL(endpoint);
    const origin = endpointURL.origin;
    const pathname = endpointURL.pathname;
    let token: string | undefined;
    if (auth) {
      if (typeof auth === "object") {
        token = await Client.getToken(auth, { origin, pathname });
      } else {
        token = auth;
      }
    }
    return new Client({ origin, pathname, ...options, token });
  }

  private static getRequestURL({
    pathname,
    origin,
    params,
  }: EntityRequest<{ pathname: string; origin: string }>) {
    const endpointURL = new URL(pathname, origin);
    const queryString = qs.stringify(params, { arrayFormat: "brackets", encodeValuesOnly: true });
    endpointURL.search = queryString;
    return endpointURL;
  }

  static async getToken(
    auth: { email: string; password: string },
    { origin, pathname }: { pathname: string; origin: string },
  ) {
    try {
      const requestURL = this.getRequestURL({
        pathname: join(pathname, "/auth/local"),
        origin,
      });
      const response = await fetch(requestURL, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ identifier: auth.email, password: auth.password }),
        agent: agentFor(requestURL),
      });
      if (!response.ok) {
        throw createSimpleException({
          code: response.status,
          message: response.statusText,
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }
      const data = await safeResponseJson(response);
      const { token } = z.object({ token: z.string() }).parse(data);
      return token;
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }
  // #endregion
  // #region INSTANCE
  private origin: string;
  private pathname: string;
  private params: RequestParams = {};
  private token: string | null = null;
  private headers: EntityRequest["headers"] = {};

  constructor(
    private options: EntityRequest<{
      origin: string;
      pathname: string;
      token?: string;
    }>,
  ) {
    const headers = (() => {
      return { ...Client.headers, ...(this.options.headers || {}) };
    })();

    const params = (() => {
      return this.options.params || this.params;
    })();

    const token = (() => {
      return this.options.token || null;
    })();

    this.origin = this.options.origin;
    this.pathname = this.options.pathname;
    this.params = params;
    this.headers = headers;
    this.token = token;
  }

  private getAuthorizedHeaders = () => {
    const headers = { ...this.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  };

  /**
   * Compone i parametri di una richiesta a partire da tre livelli, dal più debole al
   * più forte: i default del client, quelli della chiamata, quelli espliciti
   * (`locale`, `status`).
   *
   * Restituisce sempre un oggetto nuovo: il `params` di chi chiama non va toccato,
   * altrimenti una costante di modulo riusata fra due query si porta dietro il
   * `populate` della prima.
   */
  private buildParams = (params: RequestParams = {}, explicit: RequestParams = {}) => {
    const merged: RequestParams = { ...this.params, ...params };

    for (const [key, value] of Object.entries(explicit)) {
      if (value !== undefined) merged[key] = value;
    }

    return merged;
  };

  /**
   * Il messaggio d'errore di Strapi, che sta nel corpo e non nello status.
   *
   * Senza questo un populate malformato risponde `400 Bad Request` e basta, mentre
   * il corpo dice esattamente quale parametro è sbagliato.
   */
  private static async messageFrom(response: Response) {
    try {
      const body = (await safeResponseJson(response)) as any;
      const message = body?.error?.message;
      if (typeof message === "string" && message.length > 0) return message;
    } catch {
      /* Corpo non JSON o già consumato: resta lo statusText. */
    }

    return response.statusText;
  }

  /**
   * Valida un'entità contro lo schema, e traduce il fallimento in qualcosa di
   * leggibile: quale entità, quale campo, cosa ci si aspettava.
   */
  private parseEntity = (
    shape: Schema,
    data: unknown,
    { pluralID, onParseError }: { pluralID: string; onParseError: ParseErrorMode },
  ) => {
    const schema = z.object(schemaToParser(shape)).extend(defaultStrapiFields).loose();
    const result = schema.safeParse(data);

    if (result.success) return result.data;

    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(radice)"}: ${issue.message}`)
      .join("; ");
    const message = `La risposta di \`${pluralID}\` non combacia con lo schema — ${detail}`;

    if (onParseError === "throw") {
      throw createSimpleException({
        code: 422,
        type: "error",
        message,
        source: "simple-strapi/client.ts",
      });
    }

    console.warn(`⚠️ ${message}`);
    return null;
  };

  /**
   * Traduce uno schema nella query che Strapi si aspetta: quali relazioni popolare
   * (`populate`) e quali attributi chiedere (`fields`).
   *
   * I `fields` sono la metà che mancava. Senza, la proiezione ristretta è vera solo
   * nei tipi: sul filo arriva ogni attributo dell'entità e di ognuna delle sue
   * relazioni popolate — un archivio di schede che dichiara quattro campi si porta
   * a casa anche gli abstract interi.
   *
   * Restano fuori i media: il loro oggetto ha una forma fissa che lo zod di uscita
   * pretende per intero, e restringerla romperebbe il parsing invece di alleggerirlo.
   *
   * `restrict: false` disattiva i soli `fields` e lascia il populate com'è: serve a
   * chi legge campi che non ha dichiarato, cosa che i tipi non promettono ma che
   * `.loose()` permette a runtime.
   */
  private queryFromSchema = (
    shape: Schema,
    { restrict }: { restrict: boolean },
  ): { fields: string[]; populate: Record<string, any> } => {
    /**
     * Il nodo di una relazione o di un componente: `fields`, `populate`, o `true` se
     * non c'è niente da dire — che è la forma minima con cui Strapi popola tutto.
     */
    const branch = (nested: Schema) => {
      const { fields, populate } = this.queryFromSchema(nested, { restrict });
      const node: Record<string, any> = {};

      if (fields.length) node.fields = fields;
      if (Object.keys(populate).length) node.populate = populate;

      return Object.keys(node).length ? node : true;
    };

    const dynamicBlocks = ([, blocks]: DynamicField) => {
      const on: Record<string, any> = {};
      for (const [key, block] of Object.entries(blocks)) on[key] = branch(block);
      return on;
    };

    const fields: string[] = [];
    const populate: Record<string, any> = {};

    for (const [key, field] of Object.entries(shape)) {
      switch (field[0]) {
        case "text":
        case "number":
        case "boolean":
        case "json":
        case "enumeration":
        case "richText.blocks":
          if (restrict) fields.push(key);
          break;
        case "relation.hasMany":
        case "relation.hasOne":
        case "component.single":
        case "component.repeatable":
          populate[key] = branch(field[1]);
          break;
        /*
         * Un media si popola con `true` e basta. `{ populate: true }` — che è quel
         * che la libreria emetteva — Strapi 5 lo rifiuta con `Invalid key true`,
         * perché in quella posizione si aspetta i nomi dei campi da popolare e non
         * un booleano. Verificato contro un backend vero: era il motivo per cui
         * nessuna query con un'immagine poteva funzionare.
         */
        case "media.single":
        case "media.multiple":
          populate[key] = true;
          break;
        case "dynamic":
          populate[key] = { on: dynamicBlocks(field) };
          break;
      }
    }

    return { fields, populate };
  };

  private resolveRef = (ref: string): string => {
    if (ref.includes("::")) return ref;
    return `api::${ref}.${ref}`;
  };

  // #region AIGENERATED
  public async getSingle<S extends Schema>(
    pluralID: string,
    options: EntityRequest<
      {
        schema: S;
        onParseError: "skip";
        fields?: boolean;
        populate?: any;
      } & ReadRequest
    >,
  ): Promise<{ data: InferSchemaWithDefaults<S> | null; meta: any }>;
  public async getSingle<S extends Schema>(
    pluralID: string,
    options: EntityRequest<
      {
        schema: S;
        onParseError?: "throw";
        fields?: boolean;
        populate?: any;
      } & ReadRequest
    >,
  ): Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>;
  public async getSingle(
    pluralID: string,
    options: EntityRequest<
      {
        populate?: any;
      } & ReadRequest
    >,
  ): Promise<{ data: any; meta: any }>;
  public async getSingle<S extends Schema | undefined>(
    pluralID: string,
    {
      params,
      headers = {},
      locale,
      status,
      onParseError = "throw",
      fields = true,
      ...options
    }: EntityRequest<
      {
        schema?: S;
        onParseError?: ParseErrorMode;
        fields?: boolean;
        populate?: any;
      } & ReadRequest
    > = {},
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S> : any; meta: any }> {
    try {
      const requestParams = this.buildParams(params, { locale, status });

      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          const query = this.queryFromSchema(schema, { restrict: fields });
          requestParams.populate = query.populate;
          if (query.fields.length) requestParams.fields = query.fields;
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' and 'schema', the 'populate' parameter will be ignored.",
              );
          }
        }
      } else if ("populate" in options) {
        requestParams.populate = options.populate;
      }

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, pluralID),
        params: requestParams,
      });

      const response = await fetch(requestURL, {
        method: "GET",
        headers: {
          ...this.getAuthorizedHeaders(),
          ...headers,
        },
        agent: agentFor(requestURL),
      });

      if (!response.ok) {
        throw createSimpleException({
          code: response.status,
          message: await Client.messageFrom(response),
          type: "error",
          source: "simple-strapi/client.ts",
        });
      }

      const { data, meta } = z
        .object({ data: z.any(), meta: z.any() })
        .parse(await safeResponseJson(response));

      if (!data) throw createSimpleException({ code: 404, type: "error", message: "Not found" });

      if ("schema" in options) {
        const { schema: shape } = options;
        if (shape) {
          return { data: this.parseEntity(shape, data, { pluralID, onParseError }), meta } as any;
        }
      }

      return { data, meta } as any;
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }
  // #endregion

  public async getCollection<S extends Schema>(
    pluralID: string,
    options: EntityRequest<
      {
        schema: S;
        onParseError?: ParseErrorMode;
        fields?: boolean;
        pagination?: false | { page?: number; pageSize?: number };
        sort?: string | string[];
        populate?: any;
        filters?: Record<string, any>;
      } & ReadRequest
    >,
  ): Promise<{ data: InferSchemaWithDefaults<S>[]; meta: any }>;
  public async getCollection(
    pluralID: string,
    options: EntityRequest<
      {
        pagination?: false | { page?: number; pageSize?: number };
        sort?: string | string[];
        populate?: any;
        filters?: Record<string, any>;
      } & ReadRequest
    >,
  ): Promise<{ data: any[]; meta: any }>;
  public async getCollection<S extends Schema | undefined>(
    pluralID: string,
    {
      params,
      headers = {},
      pagination = { page: 1 },
      locale,
      status,
      onParseError = "throw",
      fields = true,
      ...options
    }: EntityRequest<
      {
        schema?: S;
        onParseError?: ParseErrorMode;
        fields?: boolean;
        pagination?: false | { page?: number; pageSize?: number };
        sort?: string | string[];
        populate?: any;
        filters?: Record<string, any>;
      } & ReadRequest
    > = {},
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S>[] : any[]; meta: any }> {
    try {
      const requestParams = this.buildParams(params, { locale, status });

      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          const query = this.queryFromSchema(schema, { restrict: fields });
          requestParams.populate = query.populate;
          if (query.fields.length) requestParams.fields = query.fields;
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' and 'schema', the 'populate' parameter will be ignored.",
              );
          }
        }
      } else if ("populate" in options) {
        requestParams.populate = options.populate;
      }

      if ("sort" in options) {
        requestParams.sort = options.sort;
      }

      const fetchPage = async (page: number = 1, acc: any[] = []) => {
        requestParams.pagination = { page, pageSize: 100 };
        requestParams.filters = options.filters;
        if (pagination) requestParams.pagination = { ...requestParams.pagination, ...pagination };

        const requestURL = Client.getRequestURL({
          origin: this.origin,
          pathname: join(
            ...[this.pathname, pluralID, options.where?.documentId].flatMap((entry) =>
              !!entry ? [entry] : [],
            ),
          ),
          params: requestParams,
        });

        const response = await fetch(requestURL, {
          method: "GET",
          headers: {
            ...this.getAuthorizedHeaders(),
            ...headers,
          },
          agent: agentFor(requestURL),
        });

        if (!response.ok) {
          throw createSimpleException({
            code: response.status,
            message: await Client.messageFrom(response),
            type: "error",
            source: "simple-strapi/client.ts",
          });
        }

        const responseData = await safeResponseJson(response);

        const { data, meta } = z
          // .object({ data: z.array(z.any()).catch([]), meta: z.any() })
          .object({ data: z.any(), meta: z.any() })
          .parse(responseData);

        const accData = [...acc, ...(Array.isArray(data) ? data : [data])];

        if (!pagination) {
          if (meta.pagination?.page < meta.pagination?.pageCount) {
            return await fetchPage(meta.pagination.page + 1, accData);
          }
        }

        return { data: accData as any[], meta };
      };

      const { data, meta } = await fetchPage();

      if ("schema" in options) {
        const { schema: shape } = options;
        if (shape) {
          const parsedData: any[] = [];
          for (const entry of data) {
            const parsed = this.parseEntity(shape, entry, { pluralID, onParseError });
            if (parsed !== null) {
              parsedData.push(parsed);
            }
          }
          return { data: parsedData, meta } as any;
        }
      }

      return { data, meta } as any;
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }

  /**
   *
   * WRITE ACTIONS
   *
   */

  public async update<S extends Schema>(
    pluralID: string,
    documentId: string,
    payload: any,
    options: EntityRequest<{ schema?: S }> = {},
  ): Promise<{ data: InferSchemaWithDefaults<S>; meta: any }> {
    const path = join(pluralID, documentId);
    return this.writeRequest("PUT", path, payload, options);
  }

  public async create<S extends Schema>(
    pluralID: string,
    payload: any,
    options: EntityRequest<{ schema?: S }> = {},
  ): Promise<{ data: InferSchemaWithDefaults<S>; meta: any }> {
    return this.writeRequest("POST", pluralID, payload, options);
  }

  private async writeRequest(
    method: "POST" | "PUT",
    path: string,
    payload: any,
    { params, headers = {}, ...options }: EntityRequest<{ schema?: any }> = {},
  ) {
    try {
      const requestParams = this.buildParams(params);

      if ("schema" in options && options.schema) {
        const query = this.queryFromSchema(options.schema, { restrict: true });
        requestParams.populate = query.populate;
        if (query.fields.length) requestParams.fields = query.fields;
      }

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, path),
        params: requestParams,
      });

      const response = await fetch(requestURL, {
        method,
        headers: {
          ...this.getAuthorizedHeaders(),
          ...headers,
        },
        body: JSON.stringify({ data: payload }),
        agent: agentFor(requestURL),
      });

      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => ({}));

        const getErrorMessage = (err: any): string => {
          if (err && typeof err === "object" && "error" in err) {
            return err.error?.message || response.statusText;
          }
          return response.statusText;
        };

        throw createSimpleException({
          code: response.status,
          message: getErrorMessage(errorBody),
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }

      const { data, meta } = z
        .object({ data: z.any(), meta: z.any() })
        .parse(await safeResponseJson(response));

      if ("schema" in options && options.schema) {
        const shape = options.schema;
        const schema = z.object(schemaToParser(shape)).extend(defaultStrapiFields).loose();
        const result = schema.safeParse(data);

        if (!result.success) {
          console.warn(`⚠️ ${method} response parsing error`);
          console.error("🚨 Error details:", result.error);
          return { data, meta };
        }
        return { data: result.data as any, meta };
      }

      return { data, meta };
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }

  /**
   * Elimina un'entità specifica tramite il suo documentId.
   */
  public async delete(
    pluralID: string,
    documentId: string,
    options: EntityRequest = {},
  ): Promise<{ data: any; meta: any }> {
    try {
      const { params = {}, headers = {} } = options;

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, pluralID, documentId),
        params,
      });

      const response = await fetch(requestURL, {
        method: "DELETE",
        headers: {
          ...this.getAuthorizedHeaders(),
          ...headers,
        },
        agent: agentFor(requestURL),
      });

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        throw createSimpleException({
          code: response.status,
          message: errorBody.error?.message || response.statusText,
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }

      if (response.status === 204) {
        return { data: { documentId }, meta: {} };
      }

      const { data, meta } = z
        .object({ data: z.any(), meta: z.any() })
        .parse(await safeResponseJson(response));

      return { data, meta };
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }

  /*
   * ==========================================
   * AUTO GENERATED - upload method
   * ==========================================
   */
  /**
   * Carica un file sulla Media Library di Strapi.
   *
   * @param file - Sorgente del file: `Blob`, `File` (browser) oppure stringa base64
   *               (data URI `data:mime;base64,...` o raw base64).
   * @param options.filename - Nome del file nel FormData. Obbligatorio per base64 e
   *                           Blob senza nome; per `File` viene estratto automaticamente.
   * @param options.ref - Nome del Content Type (es. `"product"` → `api::product.product`)
   *                      oppure UID completo (es. `"plugin::users-permissions.user"`).
   * @param options.refId - `documentId` dell'entità a cui agganciare il file.
   * @param options.field - Nome del campo top-level dell'entità.
   *                        ⚠️ I campi annidati (dot-notation) non sono supportati
   *                        nativamente dall'endpoint `/upload` di Strapi: caricare
   *                        il file separatamente e aggiornare l'entità con `update`.
   * @param options.path - Percorso della cartella nella Media Library (es. `"products/2024"`).
   *                       La cartella viene creata automaticamente se non esiste (mkdir -p).
   */
  public async upload(
    file: Blob | string,
    options: {
      filename?: string;
      ref?: string;
      refId?: string | number;
      field?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<ZodMediaType[]> {
    try {
      const { ref, refId, field, headers = {} } = options;

      let blob: Blob;
      let fileName: string;

      if (typeof file === "string") {
        let mimeType = "application/octet-stream";
        let rawBase64 = file;
        if (file.startsWith("data:")) {
          const commaIndex = file.indexOf(",");
          mimeType = file.slice(5, file.indexOf(";"));
          rawBase64 = file.slice(commaIndex + 1);
        }
        const bytes =
          typeof Buffer !== "undefined"
            ? new Uint8Array(Buffer.from(rawBase64, "base64"))
            : (() => {
                const bin = atob(rawBase64);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                return arr;
              })();
        blob = new Blob([bytes], { type: mimeType });
        fileName = options.filename ?? "upload";
      } else {
        blob = file;
        fileName = options.filename ?? ("name" in file ? (file as any).name : "upload");
      }

      const formData = new FormData();
      formData.append("files", blob, fileName);
      if (ref !== undefined) formData.append("ref", this.resolveRef(ref));
      if (refId !== undefined) formData.append("refId", String(refId));
      if (field !== undefined) formData.append("field", field);

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, "upload"),
        params: {},
      });

      const { "Content-Type": _ct, ...headersWithoutContentType } =
        this.getAuthorizedHeaders() as Record<string, string>;

      const response = await fetch(requestURL, {
        method: "POST",
        headers: {
          ...headersWithoutContentType,
          ...headers,
        },
        body: formData as any,
        agent: agentFor(requestURL),
      });

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        throw createSimpleException({
          code: response.status,
          message: errorBody.error?.message || response.statusText,
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }

      const data = await safeResponseJson(response);
      return z.array(zodMediaSchema).parse(data);
    } catch (exception) {
      throw ensureSimpleException(exception);
    }
  }
  /*
   * ==========================================
   * END AUTO GENERATED - upload method
   * ==========================================
   */
  // #endregion
}

export default Client;
