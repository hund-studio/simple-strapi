import z, { ZodType } from "zod";

export const zodMediaSchema = z.object({
  id: z.number(),
  name: z.string(),
  alternativeText: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  formats: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        hash: z.string().optional(),
        ext: z.string().optional(),
        mime: z.string(),
        path: z.string().nullable().optional(),
        size: z.number(),
        url: z.string(),
        width: z.number(),
        height: z.number(),
      })
    )
    .optional(),
  hash: z.string(),
  ext: z.string(),
  mime: z.string(),
  size: z.number(),
  url: z.string(),
  previewUrl: z.string().nullable(),
  provider: z.string(),
  provider_metadata: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

type ZodMediaType = z.output<typeof zodMediaSchema>;

export type MediaSingleOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferMediaSingle<O extends MediaSingleOptions> = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? ZodMediaType | null | undefined
//     : ZodMediaType | null
//   : O["optional"] extends true
//   ? ZodMediaType | undefined
//   : ZodMediaType;

export type InferMediaSingle<O extends MediaSingleOptions> = O["required"] extends true
  ? ZodMediaType
  : ZodMediaType | null | undefined;

const single = <O extends MediaSingleOptions = {}>(options: O = {} as O): ["media.single", O] => {
  return ["media.single", options];
};

export const mediaSingleSchema = (opts: MediaSingleOptions): ZodType => {
  let schema: ZodType = zodMediaSchema;
  // if (opts.nullable) schema = schema.nullable();
  // if (opts.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type MediaSingleField = readonly ["media.single", MediaSingleOptions];

export const media = { single };
