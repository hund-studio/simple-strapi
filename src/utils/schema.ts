import { booleanSchema } from "../fields/boolean.js";
import { dynamicSchema } from "../fields/dynamic.js";
import { enumerationSchema } from "../fields/enumeration.js";
import { mediaSingleSchema, mediaMultipleSchema } from "../fields/media.js";
import { numberSchema } from "../fields/number.js";
import { repeatableSchema, singleSchema } from "../fields/component.js";
import { richTextBlocksSchema } from "../fields/richText.js";
import { Schema } from "../client.js";
import { textSchema } from "../fields/text.js";
import z, { ZodType } from "zod";
import { jsonSchema } from "../fields/json.js";

/*
 * Annotato esplicitamente, come tutto ciò che questo package espone: senza, il
 * `.d.ts` porta `z.ZodISODateTime` e altri tipi interni di zod, che valgono solo per
 * la versione contro cui la libreria è compilata.
 */
export const defaultStrapiFields: Record<string, ZodType> = {
  id: z.number(),
  documentId: z.string().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  publishedAt: z.iso.datetime().nullable().optional(),
};

/**
 * I campi che Strapi mette in ogni entità. Scritti a mano per la stessa ragione di
 * `ZodMediaType`: è il tipo che finisce dentro `InferSchemaWithDefaults`, cioè nel
 * ritorno di ogni lettura, e non deve dipendere dalla versione di zod del consumer.
 */
export interface StrapiDefaults {
  id: number;
  documentId?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export const defaultStrapiFieldsSchema = z.object(defaultStrapiFields) as unknown as ZodType<StrapiDefaults>;

export const schemaToParser = (schema: Schema): Record<string, ZodType> => {
  const shape: Record<string, ZodType> = {};

  for (const [key, field] of Object.entries(schema)) {
    switch (field[0]) {
      case "text": {
        const [, args] = field;
        shape[key] = textSchema(args);
        break;
      }
      case "number": {
        const [, args] = field;
        shape[key] = numberSchema(args);
        break;
      }
      case "json": {
        const [, args] = field;
        shape[key] = jsonSchema(args);
        break;
      }
      case "boolean": {
        const [, args] = field;
        shape[key] = booleanSchema(args);
        break;
      }
      case "dynamic": {
        const [, ...args] = field;
        shape[key] = dynamicSchema(...args);
        break;
      }
      case "component.single": {
        const [, shapeDef, options] = field;
        shape[key] = singleSchema(shapeDef, options);
        break;
      }
      case "component.repeatable": {
        const [, shapeDef, options] = field;
        shape[key] = repeatableSchema(shapeDef, options);
        break;
      }
      case "media.single": {
        const [, args] = field;
        shape[key] = mediaSingleSchema(args);
        break;
      }
      case "media.multiple": {
        const [, args] = field;
        shape[key] = mediaMultipleSchema(args);
        break;
      }
      case "enumeration": {
        const [, values, options] = field;
        shape[key] = enumerationSchema(values, options);
        break;
      }
      case "richText.blocks": {
        const [, args] = field;
        shape[key] = richTextBlocksSchema(args);
        break;
      }
      default: {
        shape[key] = z.any();
      }
    }
  }

  return shape;
};
