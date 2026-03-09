import { booleanSchema } from "../fields/boolean";
import { dynamicSchema } from "../fields/dynamic";
import { enumerationSchema } from "../fields/enumeration";
import { mediaSingleSchema, mediaMultipleSchema } from "../fields/media";
import { numberSchema } from "../fields/number";
import { repeatableSchema, singleSchema } from "../fields/component";
import { richTextBlocksSchema } from "../fields/richText";
import { Schema } from "../client";
import { textSchema } from "../fields/text";
import z, { ZodType } from "zod";
import { jsonSchema } from "../fields/json";

export const defaultStrapiFields = {
  id: z.number(),
  documentId: z.string().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  publishedAt: z.iso.datetime().nullable().optional(),
};

export const defaultStrapiFieldsSchema = z.object(defaultStrapiFields);

export const schemaToParser = (schema: Schema) => {
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
