import z, { ZodType } from "zod";

type TextChild = {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type LinkChild = {
  type: "link";
  url: string;
  children: ParagraphChild[];
};

export type ParagraphChild = TextChild | LinkChild;

export const paragraphChild: z.ZodType<ParagraphChild> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      text: z.string(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      code: z.boolean().optional(),
    }),
    z.object({
      type: z.literal("link"),
      url: z.string(),
      children: z.array(paragraphChild),
    }),
  ])
);

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  children: z.array(paragraphChild),
});

const headingBlock = z.object({
  type: z.literal("heading"),
  level: z.number(),
  children: z.array(paragraphChild),
});

const listItemBlock = z.object({
  type: z.literal("list-item"),
  children: z.array(paragraphChild),
});

const listBlock = z.object({
  type: z.literal("list"),
  format: z.enum(["ordered", "unordered"]),
  children: z.array(listItemBlock),
});

export const zodRichTextBlocksSchema = z.array(z.union([paragraphBlock, headingBlock, listBlock]));

type ZodRichTextBlocksType = z.output<typeof zodRichTextBlocksSchema>;
export type RichTextBlocks = ZodRichTextBlocksType; // Public export

export type RichTextBlocksOptions = {
  // nullable?: boolean;
  // optional?: boolean;
  required?: boolean;
};

// export type InferRichTextBlocks<O extends RichTextBlocksOptions> = O["nullable"] extends true
//   ? O["optional"] extends true
//     ? ZodRichTextBlocksType | null | undefined
//     : ZodRichTextBlocksType | null
//   : O["optional"] extends true
//   ? ZodRichTextBlocksType | undefined
//   : ZodRichTextBlocksType;

export type InferRichTextBlocks<O extends RichTextBlocksOptions> = O["required"] extends true
  ? ZodRichTextBlocksType
  : ZodRichTextBlocksType | null | undefined;

const blocks = <O extends RichTextBlocksOptions = {}>(
  options: O = {} as O
): ["richText.blocks", O] => {
  return ["richText.blocks", options];
};

export const richTextBlocksSchema = (opts: RichTextBlocksOptions): ZodType => {
  let schema: ZodType = zodRichTextBlocksSchema;
  // if (opts.nullable) schema = schema.nullable();
  // if (opts.optional) schema = schema.optional();
  if (!opts.required) schema = schema.nullable().optional();
  return schema;
};

export type RichTextBlocksField = readonly ["richText.blocks", RichTextBlocksOptions];

export const richText = { blocks };
