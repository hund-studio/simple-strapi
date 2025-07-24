import z, { ZodType } from "zod";

export type TextOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferText<O extends TextOptions> = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? string | null | undefined
//     : string | null
//   : O["optional"] extends true
//   ? string | undefined
//   : string;

export type InferText<O extends TextOptions> = O["required"] extends true
  ? string
  : string | null | undefined;

export const text = <O extends TextOptions = {}>(options: O = {} as O): ["text", O] => {
  return ["text", options];
};

export const textSchema = (opts: TextOptions): ZodType => {
  let schema: ZodType = z.string();
  // if (opts.nullable) schema = schema.nullable();
  // if (opts.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type TextField = ReturnType<typeof text>;
