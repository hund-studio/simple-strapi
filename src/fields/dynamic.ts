import { InferSchema, Schema } from "../client";
import { schemaToParser } from "../utils/schema";
import z, { ZodType } from "zod";

export type DynamicOptions = {
  nullable?: boolean;
  optional?: boolean;
};

type DynamicBlocksUnion<B extends Record<string, Schema>> = {
  [K in keyof B]: { __component: K } & InferSchema<B[K]>;
}[keyof B];

export type InferDynamic<
  B extends Record<string, Schema>,
  O extends DynamicOptions
> = O["nullable"] extends true
  ? O["optional"] extends true
    ? DynamicBlocksUnion<B>[] | null | undefined
    : DynamicBlocksUnion<B>[] | null
  : O["optional"] extends true
  ? DynamicBlocksUnion<B>[] | undefined
  : DynamicBlocksUnion<B>[];

export const dynamic = <B extends Record<string, Schema>, O extends DynamicOptions = {}>(
  blocks: B,
  options: O = {} as O
): ["dynamic", B, O] => {
  return ["dynamic", blocks, options];
};

export const dynamicSchema = (blocks: Record<string, Schema>, opts: DynamicOptions): ZodType => {
  const union = Object.entries(blocks).reduce((acc, [key, fields]) => {
    const block: Record<string, any> = { __component: z.literal(key), ...schemaToParser(fields) };
    acc.push(z.object(block));
    return acc;
  }, [] as unknown as [any, ...any[]]);

  if (!union["length"]) return z.any();

  let schema: any = z.array(z.discriminatedUnion("__component", union));
  if (opts.nullable) schema = schema.nullable();
  if (opts.optional) schema = schema.optional();
  return schema;
};

export type DynamicField = readonly ["dynamic", Record<string, Schema>, DynamicOptions];
