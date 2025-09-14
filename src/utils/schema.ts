import { dynamicSchema } from "../fields/dynamic";
import { mediaSingleSchema } from "../fields/media";
import { numberSchema } from "../fields/number";
import { Schema } from "../client";
import { repeatableSchema, singleSchema } from "../fields/component";
import { textSchema } from "../fields/text";
import z, { ZodType } from "zod";
import { enumerationSchema } from "../fields/enumeration";
import { richTextBlocksSchema } from "../fields/richText";

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
