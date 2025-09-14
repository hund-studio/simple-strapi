import { createSimpleException, ensureSimpleException } from "simple-exception";
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
import { InferMediaSingle, MediaSingleField, MediaSingleOptions } from "./fields/media";
import { EnumerationField, EnumerationOptions, InferEnumeration } from "./fields/enumeration";
import { InferRichTextBlocks, RichTextBlocksField, RichTextBlocksOptions } from "./fields/richText";

type RequestParams = Record<string, any>;
type EntityRequest<P = {}> = { params?: RequestParams; headers?: Record<string, string> } & P;

export type SchemaField =
  | TextField
  | NumberField
  | RelationHasManyField
  | RelationHasOneField
  | DynamicField
  | ComponentSingleField
  | ComponentRepeatableField
  | MediaSingleField
  | EnumerationField
  | RichTextBlocksField;

export type Schema = Record<string, SchemaField>;

export type InferSchema<S extends Schema> = {
  [K in keyof S]: S[K] extends ["text", infer O extends TextOptions]
    ? InferText<O>
    : S[K] extends ["number", infer O extends NumberOptions]
    ? InferNumber<O>
    : S[K] extends [
        "relation.hasMany",
        infer R extends Schema,
        infer O extends RelationHasManyOptions
      ]
    ? InferRelationHasMany<R, O>
    : S[K] extends [
        "relation.hasOne",
        infer R extends Schema,
        infer O extends RelationHasOneOptions
      ]
    ? InferRelationHasOne<R, O>
    : S[K] extends [
        "component.single",
        infer R extends Schema,
        infer O extends ComponentSingleOptions
      ]
    ? InferComponentSingle<R, O>
    : S[K] extends [
        "component.repeatable",
        infer R extends Schema,
        infer O extends ComponentRepeatableOptions
      ]
    ? InferComponentRepeatable<R, O>
    : S[K] extends [
        "dynamic",
        infer B extends Record<string, Schema>,
        infer O extends DynamicOptions
      ]
    ? InferDynamic<B, O>
    : S[K] extends ["media.single", infer O extends MediaSingleOptions]
    ? InferMediaSingle<O>
    : S[K] extends [
        "enumeration",
        infer V extends readonly [string, ...string[]],
        infer O extends EnumerationOptions
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
    }> = {}
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
    { origin, pathname }: { pathname: string; origin: string }
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
    }>
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

  // #region AIGENERATED
  public async getSingle<S extends Schema>(
    pluralID: string,
    options: EntityRequest<{
      schema: S;
      populate?: any;
    }>
  ): Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>;
  public async getSingle(
    pluralID: string,
    options: EntityRequest<{
      populate?: any;
    }>
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
    }> = {}
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S> : any; meta: any }> {
    try {
      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          params.populate = this.populateFromSchema(schema);
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' and 'schema', the 'populate' parameter will be ignored."
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
      populate?: any;
    }>
  ): Promise<{ data: InferSchemaWithDefaults<S>[]; meta: any }>;
  public async getCollection(
    pluralID: string,
    options: EntityRequest<{
      pagination?: false | { page?: number; pageSize?: number };
      populate?: any;
    }>
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
      populate?: any;
    }> = {}
  ): Promise<{ data: S extends Schema ? InferSchemaWithDefaults<S>[] : any[]; meta: any }> {
    try {
      if ("schema" in options) {
        const { schema } = options;
        if (schema) {
          params.populate = this.populateFromSchema(schema);
          if ("populate" in options) {
            if (!!options.populate)
              console.warn(
                "⚠️ Since you provided both the 'populate' adnd 'schema', the 'populate' parameter will be ignored."
              );
          }
        }
      } else if ("populate" in options) {
        params.populate = options.populate;
      }

      const fetchPage = async (page: number = 1, acc: any[] = []) => {
        params.pagination = { page, pageSize: 100 };
        if (pagination) params.pagination = { ...params.pagination, ...pagination };

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
          .object({ data: z.array(z.any()).catch([]), meta: z.any() })
          .parse(await response.json());

        const accData = [...acc, ...data];

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
  // #endregion
}

export default Client;
