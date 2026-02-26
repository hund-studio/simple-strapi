import z, { ZodType } from "zod";

export type BooleanOptions = {
  required?: boolean;
};

export type InferBoolean<O extends BooleanOptions> = O["required"] extends true
  ? boolean
  : boolean | null | undefined;

export const boolean = <O extends BooleanOptions = {}>(options: O = {} as O): ["boolean", O] => {
  return ["boolean", options];
};

export const booleanSchema = (opts: BooleanOptions): ZodType => {
  let schema: ZodType = z.boolean();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type BooleanField = ReturnType<typeof boolean>;
