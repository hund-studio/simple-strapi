# simple-strapi

> A lightweight, type-safe Strapi v5 client for Node.js and TypeScript. Define schemas once, get fully-typed responses and automatic populate queries — no manual configuration needed.

## Features

- Schema-driven: define a schema and get fully-typed response data
- Automatic `populate` generation from schemas (deep, nested)
- Zod-based validation with safe parsing and warnings on mismatches
- Full CRUD: `getCollection`, `getSingle`, `create`, `update`, `delete`
- Auto-pagination: fetch all pages automatically or control pagination manually
- Authentication via API token or email/password credentials
- All fields support `required` option for strict TypeScript types
- Upload files to the Media Library with auto folder creation (`mkdir -p`)

## Installation

```bash
npm install simple-strapi
# or
yarn add simple-strapi
# or
bun add simple-strapi
```

## Quick start

```ts
import { StrapiClient } from "simple-strapi";

const client = await StrapiClient.create("https://my-strapi.example.com/api", {
  auth: process.env.STRAPI_TOKEN, // API token (string)
});
```

---

## Client API

### `StrapiClient.create(endpoint, options?)`

Creates and returns a new `StrapiClient` instance. This is the only way to instantiate the client.

```ts
const client = await StrapiClient.create(endpoint, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `endpoint` | `string \| URL` | Full URL including base path (e.g. `https://host.com/api`) |
| `options.auth` | `string \| { email: string; password: string }` | API token string, or credentials object for JWT auth |
| `options.params` | `Record<string, any>` | Default query params for every request |
| `options.headers` | `Record<string, string>` | Default extra headers for every request |

**Examples:**

```ts
// With API token
const client = await StrapiClient.create("https://host.com/api", {
  auth: process.env.STRAPI_TOKEN,
});

// With email/password (fetches JWT automatically)
const client = await StrapiClient.create("https://host.com/api", {
  auth: { email: "user@example.com", password: "secret" },
});

// Without auth (public API)
const client = await StrapiClient.create("https://host.com/api");
```

---

### `client.getCollection(pluralId, options?)`

Fetches a collection of entries. By default fetches all pages automatically.

```ts
const { data, meta } = await client.getCollection(pluralId, options?)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `pluralId` | `string` | — | Strapi collection plural API ID (e.g. `"articles"`) |
| `options.schema` | `Schema` | — | Field schema for typed response and auto-populate |
| `options.pagination` | `false \| { page?: number; pageSize?: number }` | `{ page: 1 }` | `false` = fetch all pages; object = single page with given params |
| `options.sort` | `string \| string[]` | — | Sort expression(s) (e.g. `"createdAt:desc"`) |
| `options.filters` | `Record<string, any>` | — | Strapi filter object |
| `options.populate` | `any` | — | Manual populate (ignored if `schema` is provided) |
| `options.params` | `Record<string, any>` | — | Additional raw query params |
| `options.headers` | `Record<string, string>` | — | Request-specific extra headers |
| `options.where.documentId` | `string` | — | Append a documentId segment to the URL path |

**Returns:** `Promise<{ data: InferSchemaWithDefaults<S>[], meta: any }>`

**Examples:**

```ts
import { StrapiClient, text, number, enumeration, media, component, dynamic, richText, boolean } from "simple-strapi";

// Typed response with schema
const { data } = await client.getCollection("articles", {
  pagination: false, // fetch all pages
  sort: "publishedAt:desc",
  filters: { status: { $eq: "published" } },
  schema: {
    title: text({ required: true }),
    slug: text({ required: true }),
    views: number(),
    published: boolean(),
    cover: media.single(),
    category: enumeration(["news", "blog", "tutorial"]),
    body: richText.blocks(),
  },
});

// data is typed as Array<{ title: string; slug: string; views: number | null | undefined; ... }>

// Untyped (no schema)
const { data: raw } = await client.getCollection("articles");
```

---

### `client.getSingle(pluralId, options?)`

Fetches a single entry. Works with both Strapi single types and collections (with filters to identify one entry).

```ts
const { data, meta } = await client.getSingle(pluralId, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `pluralId` | `string` | Strapi collection or single type plural API ID |
| `options.schema` | `Schema` | Field schema for typed response and auto-populate |
| `options.populate` | `any` | Manual populate (ignored if `schema` is provided) |
| `options.params` | `Record<string, any>` | Query params, including `filters` |
| `options.headers` | `Record<string, string>` | Request-specific extra headers |

**Returns:** `Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>`

**Example:**

```ts
const { data } = await client.getSingle("homepage", {
  schema: {
    title: text({ required: true }),
    subtitle: text(),
    hero: media.single({ required: true }),
  },
});

// With filters to identify one entry from a collection
const { data: article } = await client.getSingle("articles", {
  params: { filters: { slug: { $eq: "my-article" } } },
  schema: { title: text({ required: true }), body: richText.blocks() },
});
```

---

### `client.update(pluralId, documentId, payload, options?)`

Updates an existing entry by `documentId`.

```ts
const { data, meta } = await client.update(pluralId, documentId, payload, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `pluralId` | `string` | Strapi collection plural API ID |
| `documentId` | `string` | The Strapi v5 document ID |
| `payload` | `any` | Data to update (will be wrapped in `{ data: payload }`) |
| `options.schema` | `Schema` | Schema for parsing the response |
| `options.params` | `Record<string, any>` | Additional query params |
| `options.headers` | `Record<string, string>` | Request-specific extra headers |

**Returns:** `Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>`

**Example:**

```ts
const { data } = await client.update("articles", "abc123", { title: "New Title" }, {
  schema: { title: text({ required: true }) },
});
```

---

### `client.create(pluralId, payload, options?)`

Creates a new entry in the collection.

```ts
const { data, meta } = await client.create(pluralId, payload, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `pluralId` | `string` | Strapi collection plural API ID |
| `payload` | `any` | Data for the new entry (will be wrapped in `{ data: payload }`) |
| `options.schema` | `Schema` | Schema for parsing the response |
| `options.params` | `Record<string, any>` | Additional query params |
| `options.headers` | `Record<string, string>` | Request-specific extra headers |

**Returns:** `Promise<{ data: InferSchemaWithDefaults<S>; meta: any }>`

**Example:**

```ts
const { data } = await client.create("articles", { title: "Hello World", slug: "hello-world" });
```

---

### `client.delete(pluralId, documentId, options?)`

Deletes an entry by `documentId`.

```ts
const { data, meta } = await client.delete(pluralId, documentId, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `pluralId` | `string` | Strapi collection plural API ID |
| `documentId` | `string` | The Strapi v5 document ID |
| `options.params` | `Record<string, any>` | Additional query params |
| `options.headers` | `Record<string, string>` | Request-specific extra headers |

**Returns:** `Promise<{ data: { documentId: string }; meta: {} }>` (on 204) or `Promise<{ data: any; meta: any }>`

**Example:**

```ts
await client.delete("articles", "abc123");
```

---

### `client.upload(file, options?)`

Uploads a file to the Strapi Media Library. Returns an array of the uploaded media objects.

```ts
const media = await client.upload(file, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `file` | `Blob \| File \| string` | File source: a `Blob`, a browser `File`, a base64 data URI (`data:mime;base64,...`), or a raw base64 string |
| `options.filename` | `string` | File name in the upload form. Required for `Blob` and raw base64; auto-extracted from `File` |
| `options.ref` | `string` | Content Type name (e.g. `"product"` → auto-resolves to `api::product.product`) or a full UID (e.g. `"plugin::users-permissions.user"`) |
| `options.refId` | `string \| number` | `documentId` of the entity to attach the file to |
| `options.field` | `string` | Top-level field name on the entity. Nested fields (dot-notation) are not supported by Strapi's `/upload` endpoint |
| `options.path` | `string` | Folder path in the Media Library (e.g. `"products/2024"`). Created automatically if it doesn't exist (like `mkdir -p`) |
| `options.headers` | `Record<string, string>` | Extra request headers |

**Returns:** `Promise<ZodMediaType[]>`

**Examples:**

```ts
// Upload a File from a browser input
const [file] = inputEl.files!;
const [uploaded] = await client.upload(file, { path: "products/2024" });
console.log(uploaded.url);

// Upload a base64 data URI and attach it to an entity
const [media] = await client.upload(
  "data:image/png;base64,iVBORw0KGgo...",
  {
    filename: "cover.png",
    ref: "article",         // auto-resolved to api::article.article
    refId: "abc123",
    field: "cover",
    path: "articles",
  },
);

// Upload a Blob with a custom filename
const blob = new Blob([buffer], { type: "image/jpeg" });
const [result] = await client.upload(blob, { filename: "photo.jpg" });
```

> **Note:** Strapi's `/upload` endpoint does not support attaching files to nested fields via dot-notation. Upload the file first, then use `client.update()` to set the field.

---

## Schema field helpers

Schemas are plain objects where each key maps to a field definition tuple. All field helpers accept an optional `options` object.

> **Default nullability**: all fields default to `T | null | undefined` unless `{ required: true }` is passed. This reflects Strapi's real-world behavior where fields are frequently optional.

---

### `text(options?)`

A string field.

```ts
import { text } from "simple-strapi";

text()                    // string | null | undefined
text({ required: true }) // string
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `string` instead of `string \| null \| undefined` |

TypeScript types: `TextField`, `TextOptions`, `InferText<O>`

---

### `number(options?)`

A numeric field.

```ts
import { number } from "simple-strapi";

number()                    // number | null | undefined
number({ required: true }) // number
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `number` instead of `number \| null \| undefined` |

TypeScript types: `NumberField`, `NumberOptions`, `InferNumber<O>`

---

### `boolean(options?)`

A boolean field.

```ts
import { boolean } from "simple-strapi";

boolean()                    // boolean | null | undefined
boolean({ required: true }) // boolean
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `boolean` instead of `boolean \| null \| undefined` |

TypeScript types: `BooleanField`, `BooleanOptions`, `InferBoolean<O>`

---

### `json(options?)`

A JSON field (typed as `any`).

```ts
import { json } from "simple-strapi";

json()                    // any | null | undefined
json({ required: true }) // any
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `any` instead of `any \| null \| undefined` |

TypeScript types: `JSONField`, `JSONOptions`, `InferJSON<O>`

---

### `enumeration(values, options?)`

An enum field constrained to a fixed list of string values.

```ts
import { enumeration } from "simple-strapi";

enumeration(["draft", "published", "archived"])
// "draft" | "published" | "archived" | null | undefined

enumeration(["draft", "published"], { required: true })
// "draft" | "published"
```

| Parameter | Type | Description |
|---|---|---|
| `values` | `readonly [string, ...string[]]` | Non-empty tuple of allowed string values |

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `V[number]` instead of `V[number] \| null \| undefined` |

TypeScript types: `EnumerationField`, `EnumerationOptions`, `InferEnumeration<V, O>`

---

### `media.single(options?)`

A single Strapi media upload field. Automatically adds the correct `populate` entry.

```ts
import { media } from "simple-strapi";

media.single()                    // MediaType | null | undefined
media.single({ required: true }) // MediaType
```

The resolved `MediaType` shape:

```ts
{
  id: number;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  formats: Record<string, { name, hash?, ext?, mime, path?, size, url, width, height }> | null | undefined;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl: string | null;
  provider: string;
  provider_metadata: unknown | null;
  createdAt: string;
  updatedAt: string;
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `MediaType` instead of `MediaType \| null \| undefined` |

TypeScript types: `MediaSingleField`, `MediaSingleOptions`, `InferMediaSingle<O>`, `ZodMediaType`, `zodMediaSchema`

---

### `richText.blocks(options?)`

A Strapi rich text blocks field (Strapi v5 block editor format).

```ts
import { richText } from "simple-strapi";

richText.blocks()                    // RichTextBlocks | null | undefined
richText.blocks({ required: true }) // RichTextBlocks
```

`RichTextBlocks` is an array of block nodes:

```ts
type RichTextBlocks = Array<
  | { type: "paragraph"; children: ParagraphChild[] }
  | { type: "heading"; level: number; children: ParagraphChild[] }
  | { type: "list"; format: "ordered" | "unordered"; children: ListItemBlock[] }
>

type ParagraphChild =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; code?: boolean }
  | { type: "link"; url: string; children: ParagraphChild[] }
```

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, type is `RichTextBlocks` instead of `RichTextBlocks \| null \| undefined` |

TypeScript types: `RichTextBlocksField`, `RichTextBlocksOptions`, `InferRichTextBlocks<O>`, `RichTextBlocks`, `ParagraphChild`, `zodRichTextBlocksSchema`, `paragraphChild`

---

### `component.single(schema, options?)`

A Strapi single (non-repeatable) component. Automatically populates nested fields.

```ts
import { component, text, media } from "simple-strapi";

component.single({ title: text(), image: media.single() })
// { id: number; documentId?: string; title: string | null | undefined; image: MediaType | null | undefined; ... } | null | undefined

component.single({ title: text() }, { required: true })
// { id: number; ...; title: string | null | undefined } — not nullable
```

| Parameter | Type | Description |
|---|---|---|
| `schema` | `Schema` | Field schema of the component |

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, component is not nullable/optional |

TypeScript types: `ComponentSingleField`, `ComponentSingleOptions`, `InferComponentSingle<S, O>`

---

### `component.repeatable(schema, options?)`

A Strapi repeatable component (array). Automatically populates nested fields.

```ts
import { component, text } from "simple-strapi";

component.repeatable({ label: text(), value: text() })
// Array<{ id: number; label: string | null | undefined; ... }> | null | undefined

component.repeatable({ label: text() }, { required: true })
// Array<{ id: number; label: string | null | undefined; ... }>
```

| Parameter | Type | Description |
|---|---|---|
| `schema` | `Schema` | Field schema of the component items |

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | If true, array is not nullable/optional |

TypeScript types: `ComponentRepeatableField`, `ComponentRepeatableOptions`, `InferComponentRepeatable<S, O>`

---

### `relation.hasMany(schema, options?)`

A Strapi relation that returns multiple related entries. Automatically populates the relation.

```ts
import { relation, text } from "simple-strapi";

relation.hasMany({ name: text() })
// Array<{ id: number; name: string | null | undefined; ... }>

relation.hasMany({ name: text() }, { nullable: true, optional: true })
// Array<...> | null | undefined
```

| Parameter | Type | Description |
|---|---|---|
| `schema` | `Schema` | Field schema of the related entries |

| Option | Type | Default | Description |
|---|---|---|---|
| `nullable` | `boolean` | `false` | If true, result can be `null` |
| `optional` | `boolean` | `false` | If true, result can be `undefined` |

TypeScript types: `RelationHasManyField`, `RelationHasManyOptions`, `InferRelationHasMany<S, O>`

---

### `relation.hasOne(schema, options?)`

A Strapi relation that returns a single related entry. Automatically populates the relation.

```ts
import { relation, text } from "simple-strapi";

relation.hasOne({ name: text() })
// { id: number; name: string | null | undefined; ... }

relation.hasOne({ name: text() }, { nullable: true })
// { id: number; ... } | null
```

| Parameter | Type | Description |
|---|---|---|
| `schema` | `Schema` | Field schema of the related entry |

| Option | Type | Default | Description |
|---|---|---|---|
| `nullable` | `boolean` | `false` | If true, result can be `null` |
| `optional` | `boolean` | `false` | If true, result can be `undefined` |

TypeScript types: `RelationHasOneField`, `RelationHasOneOptions`, `InferRelationHasOne<S, O>`

---

### `dynamic(blocks, options?)`

A Strapi dynamic zone. Each key is a component UID, each value is the component's schema. The result is a discriminated union array tagged with `__component`.

```ts
import { dynamic, text, media, enumeration, component, richText } from "simple-strapi";

dynamic({
  "blocks.hero": { title: text({ required: true }), image: media.single() },
  "blocks.content": { body: richText.blocks() },
})
// Array<
//   | { __component: "blocks.hero"; title: string; image: MediaType | null | undefined }
//   | { __component: "blocks.content"; body: RichTextBlocks | null | undefined }
// >
```

| Parameter | Type | Description |
|---|---|---|
| `blocks` | `Record<string, Schema>` | Map of component UIDs to their schemas |

| Option | Type | Default | Description |
|---|---|---|---|
| `nullable` | `boolean` | `false` | If true, result can be `null` |
| `optional` | `boolean` | `false` | If true, result can be `undefined` |

TypeScript types: `DynamicField`, `DynamicOptions`, `InferDynamic<B, O>`

---

## TypeScript type utilities

All types exported from `simple-strapi`:

| Type | Description |
|---|---|
| `Schema` | `Record<string, SchemaField>` — the shape of a schema definition |
| `SchemaField` | Union of all field tuple types |
| `InferSchema<S>` | Infers the TypeScript shape from a `Schema` (without default Strapi fields) |
| `InferSchemaWithDefaults<S>` | Same as `InferSchema<S>` plus `id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt` |

---

## Default Strapi fields

Every entity returned by the client automatically includes these fields (regardless of schema):

| Field | Type |
|---|---|
| `id` | `number` |
| `documentId` | `string \| undefined` |
| `createdAt` | `string \| undefined` (ISO datetime) |
| `updatedAt` | `string \| undefined` (ISO datetime) |
| `publishedAt` | `string \| null \| undefined` (ISO datetime) |

---

## Full example

```ts
import {
  StrapiClient,
  text,
  number,
  boolean,
  json,
  enumeration,
  media,
  richText,
  component,
  dynamic,
  relation,
} from "simple-strapi";

const client = await StrapiClient.create(process.env.STRAPI_URL!, {
  auth: process.env.STRAPI_TOKEN,
});

const { data: events } = await client.getCollection("events", {
  pagination: false,
  sort: "publishedAt:desc",
  filters: { status: { $eq: "published" } },
  schema: {
    title: text({ required: true }),
    slug: text({ required: true }),
    status: enumeration(["draft", "published", "archived"], { required: true }),
    featured: boolean(),
    price: number(),
    metadata: json(),
    cover: media.single({ required: true }),
    tags: relation.hasMany({ name: text({ required: true }) }),
    location: relation.hasOne({ city: text(), country: text() }),
    header: component.single({
      headline: text({ required: true }),
      background: media.single(),
    }),
    speakers: component.repeatable({
      name: text({ required: true }),
      bio: richText.blocks(),
      avatar: media.single(),
    }),
    blocks: dynamic({
      "blocks.text": { body: richText.blocks({ required: true }) },
      "blocks.gallery": {
        layout: enumeration(["grid", "masonry"]),
        images: component.repeatable({ image: media.single({ required: true }), caption: text() }),
      },
    }),
  },
});
```

---

## License

[ISC](../LICENSE)

## Maintainer

[@hund-ernesto](https://github.com/hund-ernesto)
