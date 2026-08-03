import z, { ZodType } from "zod";

/**
 * Un media della Media Library, **scritto a mano** e non dedotto dallo zod.
 *
 * Il tipo dedotto (`z.output<typeof zodMediaSchema>`) finisce nel `.d.ts` come una
 * struttura enorme piena di riferimenti interni a zod — `z.core.$strip`,
 * `z.ZodISODateTime` — che valgono solo per la versione di zod contro cui questa
 * libreria è stata compilata. Un consumer che ne risolve un'altra si ritrova i tipi
 * rotti, e con `skipLibCheck` attivo non lo scopre: gli arriva `any` senza un
 * errore. È successo davvero, e costa una giornata a capirlo.
 *
 * Scritto a mano, il tipo pubblico è indipendente dalla versione di zod. Lo schema
 * resta la fonte a runtime, e l'annotazione esplicita li tiene allineati: se la
 * validazione e questa interfaccia divergono, non compila.
 */
export interface ZodMediaFormat {
  name: string;
  hash?: string;
  ext?: string;
  mime: string;
  path?: string | null;
  size: number;
  url: string;
  width: number;
  height: number;
}

export interface ZodMediaType {
  id: number;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  formats?: Record<string, ZodMediaFormat> | null;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl: string | null;
  provider: string;
  provider_metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export const zodMediaSchema: ZodType<ZodMediaType> = z.object({
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
    .nullable()
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
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type MediaSingleField = readonly ["media.single", MediaSingleOptions];

export type MediaMultipleOptions = {
  required?: boolean;
};

export type InferMediaMultiple<O extends MediaMultipleOptions> = O["required"] extends true
  ? ZodMediaType[]
  : ZodMediaType[] | null | undefined;

const multiple = <O extends MediaMultipleOptions = {}>(options: O = {} as O): ["media.multiple", O] => {
  return ["media.multiple", options];
};

export const mediaMultipleSchema = (opts: MediaMultipleOptions): ZodType => {
  let schema: ZodType = z.array(zodMediaSchema);
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type MediaMultipleField = readonly ["media.multiple", MediaMultipleOptions];

export const media = { single, multiple };
