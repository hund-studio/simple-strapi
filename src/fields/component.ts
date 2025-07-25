import z, { ZodType } from "zod";
import { InferSchema, Schema } from "../client";
import { schemaToParser } from "../utils/schema";

/**
 * SINGLE
 */

export type ComponentSingleOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferComponentSingle<
//   S extends Schema,
//   O extends ComponentSingleOptions
// > = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? InferSchema<S> | null | undefined
//     : InferSchema<S> | null
//   : O["optional"] extends true
//   ? InferSchema<S> | undefined
//   : InferSchema<S>;

export type InferComponentSingle<
  S extends Schema,
  O extends ComponentSingleOptions
> = O["required"] extends true ? InferSchema<S> : InferSchema<S> | null | undefined;

const single = <S = any, O extends ComponentSingleOptions = {}>(
  shape: S,
  options: O = {} as O
): ["component.single", S, O] => {
  return ["component.single", shape, options];
};

export const singleSchema = (shape: Schema, opts: ComponentSingleOptions): ZodType => {
  let schema: ZodType = z.object(schemaToParser(shape));
  // if (opts.nullable) schema = schema.nullable();
  // if (opts.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type ComponentSingleField = readonly ["component.single", Schema, ComponentSingleOptions];

/**
 * REPEATABLE
 */

export type ComponentRepeatableOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferComponentRepeatable<
//   S extends Schema,
//   O extends ComponentRepeatableOptions
// > = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? InferSchema<S>[] | null | undefined
//     : InferSchema<S>[] | null
//   : O["optional"] extends true
//   ? InferSchema<S>[] | undefined
//   : InferSchema<S>[];

export type InferComponentRepeatable<
  S extends Schema,
  O extends ComponentRepeatableOptions
> = O["required"] extends true ? InferSchema<S>[] : InferSchema<S>[] | null | undefined;

const repeatable = <S = any, O extends ComponentRepeatableOptions = {}>(
  shape: S,
  options: O = {} as O
): ["component.repeatable", S, O] => {
  return ["component.repeatable", shape, options];
};

export const repeatableSchema = (shape: Schema, opts: ComponentRepeatableOptions): ZodType => {
  let schema: ZodType = z.array(z.object(schemaToParser(shape)));
  // if (opts.nullable) schema = schema.nullable();
  // if (opts.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type ComponentRepeatableField = readonly [
  "component.repeatable",
  Schema,
  ComponentRepeatableOptions
];

export const component = { single, repeatable };
