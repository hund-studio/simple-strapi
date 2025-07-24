import z, { ZodType } from "zod";

export type EnumerationOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferEnumeration<
//   V extends readonly [string, ...string[]],
//   O extends EnumerationOptions
// > = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? V[number] | null | undefined
//     : V[number] | null
//   : O["optional"] extends true
//   ? V[number] | undefined
//   : V[number];

export type InferEnumeration<
  V extends readonly [string, ...string[]],
  O extends EnumerationOptions
> = O["required"] extends true ? V[number] : V[number] | null | undefined;

export const enumeration = <
  Values extends readonly [string, ...string[]],
  O extends EnumerationOptions = {}
>(
  values: Values,
  options: O = {} as O
): ["enumeration", Values, O] => {
  return ["enumeration", values, options];
};

export const enumerationSchema = (
  values: readonly [string, ...string[]],
  opts: EnumerationOptions
): ZodType => {
  let schema: ZodType = z.enum([...values] as [string, ...string[]]);
  // if (options.nullable) schema = schema.nullable();
  // if (options.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type EnumerationField = ReturnType<typeof enumeration>;
