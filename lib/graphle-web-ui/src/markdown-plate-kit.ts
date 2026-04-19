import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseHeadingPlugin,
  BaseHorizontalRulePlugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
} from "@platejs/basic-nodes";
import { BaseCodeBlockPlugin, BaseCodeLinePlugin, BaseCodeSyntaxPlugin } from "@platejs/code-block";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import { MarkdownPlugin } from "@platejs/markdown";
import {
  BaseTableCellHeaderPlugin,
  BaseTableCellPlugin,
  BaseTablePlugin,
  BaseTableRowPlugin,
} from "@platejs/table";
import { createLowlight } from "lowlight";
import { BaseParagraphPlugin, createSlateEditor } from "platejs";
import remarkGfm from "remark-gfm";

const markdownPlateLowlight = createLowlight();

export function createMarkdownPlatePlugins() {
  return [
    BaseParagraphPlugin,
    BaseHeadingPlugin,
    BaseBlockquotePlugin,
    BaseHorizontalRulePlugin,
    BaseBoldPlugin,
    BaseItalicPlugin,
    BaseStrikethroughPlugin,
    BaseCodePlugin,
    BaseLinkPlugin,
    BaseListPlugin,
    BaseTablePlugin,
    BaseTableRowPlugin,
    BaseTableCellPlugin,
    BaseTableCellHeaderPlugin,
    BaseCodeBlockPlugin.configure({
      options: {
        defaultLanguage: null,
        lowlight: markdownPlateLowlight,
      },
    }),
    BaseCodeLinePlugin,
    BaseCodeSyntaxPlugin,
    MarkdownPlugin.configure({
      options: {
        remarkPlugins: [remarkGfm],
      },
    }),
  ];
}

export function createMarkdownPlateEditor() {
  return createSlateEditor({
    plugins: createMarkdownPlatePlugins(),
  });
}
