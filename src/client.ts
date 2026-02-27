import { createSimpleException, ensureSimpleException } from "simple-exception";
import { InferBoolean, BooleanField, BooleanOptions } from "./fields/boolean";
import { InferNumber, NumberField, NumberOptions } from "./fields/number";
import { InferText, TextField, TextOptions } from "./fields/text";
import { join } from "path";
import {
  InferRelationHasMany,
  InferRelationHasOne,
  RelationHasManyField,
  RelationHasManyOptions,
  RelationHasOneField,
  RelationHasOneOptions,
} from "./fields/relation";
import fetch from "node-fetch";
import qs from "qs";
import z from "zod";
import { DynamicField, DynamicOptions, InferDynamic } from "./fields/dynamic";
import { defaultStrapiFields, defaultStrapiFieldsSchema, schemaToParser } from "./utils/schema";
import {
  ComponentRepeatableField,
  ComponentRepeatableOptions,
  ComponentSingleField,
  ComponentSingleOptions,
  InferComponentRepeatable,
  InferComponentSingle,
} from "./fields/component";
import {
  InferMediaSingle,
  MediaSingleField,
  MediaSingleOptions,
  zodMediaSchema,
  ZodMediaType,
} from "./fields/media";
import { EnumerationField, EnumerationOptions, InferEnumeration } from "./fields/enumeration";
import { InferRichTextBlocks, RichTextBlocksField, RichTextBlocksOptions } from "./fields/richText";
import { InferJSON, JSONField, JSONOptions } from "./fields/json";

type RequestParams = Record<string, any>;
type EntityRequest<P = {}> = {
  where?: Record<string, string>;
  params?: RequestParams;
  headers?: Record<string, string>;
} & P;

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

export type InferSchemaWithDefaults<S extends Schema> = InferSchema<S> &
  z.output<typeof defaultStrapiFieldsSchema>;

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
      });
      if (!response.ok) {
        throw createSimpleException({
          code: response.status,
          message: response.statusText,
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }
      const data = await response.json();
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

  private populateFromSchema = (shape: Schema) => {
    const populateHasManyRelation = ([, shape]: RelationHasManyField) => {
      return this.populateFromSchema(shape);
    };

    const populateHasOneRelation = ([, shape]: RelationHasOneField) => {
      return this.populateFromSchema(shape);
    };

    const populateComponentSingle = ([, shape]: ComponentSingleField) => {
      return this.populateFromSchema(shape);
    };

    const populateComponentRepeatable = ([, shape]: ComponentRepeatableField) => {
      return this.populateFromSchema(shape);
    };

    const populateDynamic = ([, shape]: DynamicField) => {
      const blocks: Record<string, any> = {};

      for (const [key, field] of Object.entries(shape)) {
        blocks[key] = { populate: this.populateFromSchema(field) };
        if (!Object.keys(blocks[key].populate)["length"]) blocks[key] = true;
      }

      return blocks;
    };

    const populate: Record<string, any> = {};

    for (const [key, field] of Object.entries(shape)) {
      switch (field[0]) {
        case "relation.hasMany":
          populate[key] = { populate: populateHasManyRelation(field) };
          if (!Object.keys(populate[key].populate)["length"]) populate[key] = true;
          break;
        case "relation.hasOne":
          populate[key] = { populate: populateHasOneRelation(field) };
          if (!Object.keys(populate[key].populate)["length"]) populate[key] = true;
          break;
        case "component.single":
          populate[key] = { populate: populateComponentSingle(field) };
          if (!Object.keys(populate[key].populate)["length"]) populate[key] = true;
          break;
        case "component.repeatable":
          populate[key] = { populate: populateComponentRepeatable(field) };
          if (!Object.keys(populate[key].populate)["length"]) populate[key] = true;
          break;
        case "media.single":
          populate[key] = { populate: true };
          break;
        case "dynamic":
          populate[key] = { on: populateDynamic(field) };
          break;
      }
    }

    return populate;
  };

  private resolveRef = (ref: string): string => {
    if (ref.includes("::")) return ref;
    return `api::${ref}.${ref}`;
  };

  // #region AIGENERATED
  public async getSingle<S extends Schema>(
    pluralID: string,
    options: EntityRequest<{
      schema: S;
      populate?: any;
    }>,
  ): Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>;
  public async getSingle(
    pluralID: string,
    options: EntityRequest<{
      populate?: any;
    }>,
  ): Promise<{ data: any; meta: any }>;
  public async getSingle<S extends Schema | undefined>(
    pluralID: string,
    {
      params = {},
      headers = {},
      ...options
    }: EntityRequest<{
      schema?: S;
      populate?: any;
    }> = {},
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S> : any; meta: any }> {
    try {
      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          params.populate = this.populateFromSchema(schema);
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' and 'schema', the 'populate' parameter will be ignored.",
              );
          }
        }
      } else if ("populate" in options) {
        params.populate = options.populate;
      }

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, pluralID),
        params,
      });

      const response = await fetch(requestURL, {
        method: "GET",
        headers: {
          ...this.getAuthorizedHeaders(),
          ...headers,
        },
      });

      if (!response.ok) {
        throw createSimpleException({
          code: response.status,
          message: response.statusText,
          type: "error",
          source: "strapi-utils/client.ts",
        });
      }

      const { data, meta } = z
        .object({ data: z.any(), meta: z.any() })
        .parse(await response.json());

      if (!data) throw createSimpleException({ code: 404, type: "error", message: "Not found" });

      if ("schema" in options) {
        const { schema: shape } = options;
        if (shape) {
          const schema = z.object(schemaToParser(shape)).extend(defaultStrapiFields).loose();
          const result = schema.safeParse(data);
          if (!result.success) {
            console.warn("⚠️ Single entity parsing error");
            console.error("🚨 Error", result.error);
            return { data: null as any, meta };
          }
          return { data: result.data as any, meta };
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
    options: EntityRequest<{
      schema: S;
      pagination?: false | { page?: number; pageSize?: number };
      sort?: string | string[];
      populate?: any;
      filters?: Record<string, any>;
    }>,
  ): Promise<{ data: InferSchemaWithDefaults<S>[]; meta: any }>;
  public async getCollection(
    pluralID: string,
    options: EntityRequest<{
      pagination?: false | { page?: number; pageSize?: number };
      sort?: string | string[];
      populate?: any;
      filters?: Record<string, any>;
    }>,
  ): Promise<{ data: any[]; meta: any }>;
  public async getCollection<S extends Schema | undefined>(
    pluralID: string,
    {
      params = {},
      headers = {},
      pagination = { page: 1 },
      ...options
    }: EntityRequest<{
      schema?: S;
      pagination?: false | { page?: number; pageSize?: number };
      sort?: string | string[];
      populate?: any;
      filters?: Record<string, any>;
    }> = {},
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S>[] : any[]; meta: any }> {
    try {
      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          params.populate = this.populateFromSchema(schema);
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' adnd 'schema', the 'populate' parameter will be ignored.",
              );
          }
        }
      } else if ("populate" in options) {
        params.populate = options.populate;
      }

      if ("sort" in options) {
        params.sort = options.sort;
      }

      const fetchPage = async (page: number = 1, acc: any[] = []) => {
        params.pagination = { page, pageSize: 100 };
        params.filters = options.filters;
        if (pagination) params.pagination = { ...params.pagination, ...pagination };

        const requestURL = Client.getRequestURL({
          origin: this.origin,
          pathname: join(
            ...[this.pathname, pluralID, options.where?.documentId].flatMap((entry) =>
              !!entry ? [entry] : [],
            ),
          ),
          params,
        });

        const response = await fetch(requestURL, {
          method: "GET",
          headers: {
            ...this.getAuthorizedHeaders(),
            ...headers,
          },
        });

        if (!response.ok) {
          throw createSimpleException({
            code: response.status,
            message: response.statusText,
            type: "error",
            source: "strapi-utils/client.ts",
          });
        }

        const responseData = await response.json();

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
          const schema = z.object(schemaToParser(shape)).extend(defaultStrapiFields).loose();
          const parsedData: any[] = [];
          for (const entry of data) {
            const result = schema.safeParse(entry);
            if (result.success) {
              parsedData.push(result.data);
            } else {
              console.warn("⚠️ Collection parsing error on entry", entry);
              console.error("🚨 Error", result.error);
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
    { params = {}, headers = {}, ...options }: EntityRequest<{ schema?: any }> = {},
  ) {
    try {
      if ("schema" in options && options.schema) {
        params.populate = this.populateFromSchema(options.schema);
      }

      const requestURL = Client.getRequestURL({
        origin: this.origin,
        pathname: join(this.pathname, path),
        params,
      });

      const response = await fetch(requestURL, {
        method,
        headers: {
          ...this.getAuthorizedHeaders(),
          ...headers,
        },
        body: JSON.stringify({ data: payload }),
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
        .parse(await response.json());

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
        .parse(await response.json());

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

      const data = await response.json();
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
