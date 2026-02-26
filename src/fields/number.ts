import z, { ZodType } from "zod";

export type NumberOptions = {
  required?: boolean;
};

export type InferNumber<O extends NumberOptions> = O["required"] extends true
  ? number
  : number | null | undefined;

export const number = <O extends NumberOptions = {}>(options: O = {} as O): ["number", O] => {
  return ["number", options];
};

export const numberSchema = (opts: NumberOptions): ZodType => {
  let schema: ZodType = z.number();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type NumberField = ReturnType<typeof number>;
