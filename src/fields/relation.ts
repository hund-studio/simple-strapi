import { InferSchema, Schema } from "../client";

export type RelationHasManyOptions = {
  nullable?: boolean;
  optional?: boolean;
};

export type InferRelationHasMany<
  S extends Schema,
  O extends RelationHasManyOptions
> = O["nullable"] extends true
  ? O["optional"] extends true
    ? InferSchema<S>[] | null | undefined
    : InferSchema<S>[] | null
  : O["optional"] extends true
  ? InferSchema<S>[] | undefined
  : InferSchema<S>[];

const hasMany = <S = any, O extends RelationHasManyOptions = {}>(
  shape: S,
  options: O = {} as O
): ["relation.hasMany", S, O] => {
  return ["relation.hasMany", shape, options];
};

export type RelationHasManyField = readonly ["relation.hasMany", Schema, RelationHasManyOptions];

export const relation = { hasMany };
