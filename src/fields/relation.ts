import { InferSchema, Schema } from "../client";

/**
 * HAS MANY
 */

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

/**
 * HAS ONE
 */

export type RelationHasOneOptions = {
  nullable?: boolean;
  optional?: boolean;
};

export type InferRelationHasOne<
  S extends Schema,
  O extends RelationHasOneOptions
> = O["nullable"] extends true
  ? O["optional"] extends true
    ? InferSchema<S> | null | undefined
    : InferSchema<S> | null
  : O["optional"] extends true
  ? InferSchema<S> | undefined
  : InferSchema<S>;

const hasOne = <S = any, O extends RelationHasOneOptions = {}>(
  shape: S,
  options: O = {} as O
): ["relation.hasOne", S, O] => {
  return ["relation.hasOne", shape, options];
};

export type RelationHasOneField = readonly ["relation.hasOne", Schema, RelationHasOneOptions];

export const relation = { hasMany, hasOne };
