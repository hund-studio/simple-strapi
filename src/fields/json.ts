import z, { ZodType } from "zod";

export type JSONOptions = {
  required?: boolean;
};

export type InferJSON<O extends JSONOptions> = O["required"] extends true
  ? any
  : any | null | undefined;

export const json = <O extends JSONOptions = {}>(options: O = {} as O): ["json", O] => {
  return ["json", options];
};

export const jsonSchema = (opts: JSONOptions): ZodType => {
  let schema: ZodType = z.any();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type JSONField = ReturnType<typeof json>;
