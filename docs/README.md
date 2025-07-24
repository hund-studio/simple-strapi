# simple-strapi

> ⚠️ **Important:** This package is primarily intended for internal use. It is publicly available, but its structure may change significantly between versions. The LTS version of the package will be published on npm as `simple-strapi`.

> 📦 A lightweight and intuitive Strapi client library for fetching collections and single entries with schema-based validation and flexible field types.

## Features

- Easy fetching of collections and single entries from a Strapi API
- Define schemas for response data using convenient utility functions
- Support for Strapi components, dynamic zones, media, rich text, enumerations, and text fields
- Type-safe and extensible API interface
- Authentication support with API tokens or credentials

## Installation

Run the following to install the package:

```bash
npm install simple-strapi
# or
yarn add simple-strapi
```

## Usage

### Initialize the client

```ts
import { StrapiClient } from "simple-strapi";

const strapiClient = await StrapiClient.create(process.env.STRAPI_HOST!, {
  auth: process.env.STRAPI_FULL_ACCESS,
});

export default strapiClient;
```

### Fetch a collection

```ts
import {
  StrapiClient,
  component,
  dynamic,
  enumeration,
  media,
  richText,
  text,
} from "simple-strapi";

const strapiClient = await StrapiClient.create(process.env.STRAPI_HOST!, {
  auth: process.env.STRAPI_FULL_ACCESS,
});

const { data: collection } = await strapiClient.getCollection("events", {
  pagination: false,
  schema: {
    title: text(),
    heading: component.single({ image: media.single() }),
    blocks: dynamic({
      "blocks.content": {
        align: enumeration(["left", "right"]),
        body: component.repeatable({
          type: enumeration(["paragraph", "image"]),
          paragraph: richText.blocks(),
          image: media.single(),
        }),
        aside: component.single({
          body: component.repeatable({
            type: enumeration(["paragraph", "image"]),
            paragraph: richText.blocks(),
            image: media.single(),
          }),
        }),
      },
    }),
  },
});
```

### Fetch a single entry with filters

```ts
import {
  StrapiClient,
  component,
  dynamic,
  enumeration,
  media,
  richText,
  text,
} from "simple-strapi";

const strapiClient = await StrapiClient.create(process.env.STRAPI_HOST!, {
  auth: process.env.STRAPI_FULL_ACCESS,
});

const { data: single } = await strapiClient.getSingle("events", {
  params: {
    filters: { title: { $eq: "Pizelo" } },
  },
  schema: {
    title: text(),
    heading: component.single({ image: media.single() }),
    blocks: dynamic({
      "blocks.content": {
        align: enumeration(["left", "right"]),
        body: component.repeatable({
          type: enumeration(["paragraph", "image"]),
          paragraph: richText.blocks(),
          image: media.single(),
        }),
        aside: component.single({
          body: component.repeatable({
            type: enumeration(["paragraph", "image"]),
            paragraph: richText.blocks(),
            image: media.single(),
          }),
        }),
      },
    }),
  },
});

console.log(single.title); // (property) title: string | null | undefined
```

> **Note**: When using a schema, the output (data) is correctly typed according to the schema definitions, providing full TypeScript support and type safety.

## API

### StrapiClient.create()

`StrapiClient.create(baseUrl: string, options?: { auth?: string })`

Creates a new Strapi client instance.

- `baseUrl`: The base URL of your Strapi API.
- `options.auth`: Optional authentication token (e.g. API key or bearer token).

### strapiClient.getCollection()

`strapiClient.getCollection(collectionName: string, options: GetCollectionOptions)`

Fetches a collection of entries.

- `collectionName`: Name of the collection type.
- `options.pagination`: Optional, whether to paginate results.
- `options.schema`: Schema definition to validate and parse response data.

### strapiClient.getSingle()

`strapiClient.getSingle(singleTypeName: string, options: GetSingleOptions)`

Fetches a single entry matching optional filters.

- `singleTypeName`: Name of the single type.
- `options.params`: Query params, including filters.
- `options.schema`: Schema definition.

## Schema utilities

The package exports various helpers to build schemas for your Strapi data:

- `text()` - plain text field
- `media.single()` - single media item
- `component.single(schema)` - single component
- `component.repeatable(schema)` - repeatable components
- `dynamic(schema)` - dynamic zone
- `enumeration(allowedValues)` - enum field
- `richText.blocks()` - rich text blocks

## License

[ISC](../LICENSE)

## Maintainer

[@hund-ernesto](https://github.com/hund-ernesto)
