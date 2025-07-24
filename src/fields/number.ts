import z, { ZodType } from "zod";

export type NumberOptions = {
  nullable?: boolean;
  optional?: boolean;
};

export type InferNumber<O extends NumberOptions> = O["nullable"] extends true
  ? O["optional"] extends true
    ? number | null | undefined
    : number | null
  : O["optional"] extends true
  ? number | undefined
  : number;

export const number = <O extends NumberOptions = {}>(options: O = {} as O): ["number", O] => {
  return ["number", options];
};

export const numberSchema = (opts: NumberOptions): ZodType => {
  let schema: any = z.number();
  if (opts.nullable) schema = schema.nullable();
  if (opts.optional) schema = schema.optional();
  return schema;
};

export type NumberField = ReturnType<typeof number>;
