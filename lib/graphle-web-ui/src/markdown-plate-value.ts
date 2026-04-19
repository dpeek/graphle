import type { Value } from "platejs";

import { createMarkdownPlateEditor } from "./markdown-plate-kit.js";

type MarkdownPlateTextNode = {
  text: string;
  [key: string]: unknown;
};

type MarkdownPlateElementNode = {
  children: MarkdownPlateNode[];
  type: string;
  [key: string]: unknown;
};

type MarkdownPlateNode = MarkdownPlateElementNode | MarkdownPlateTextNode;

export type MarkdownPlateValue = MarkdownPlateElementNode[];

export function emptyMarkdownPlateValue(): MarkdownPlateValue {
  return [
    {
      children: [{ text: "" }],
      type: "p",
    },
  ];
}

export function deserializeMarkdownToPlateValue(markdown: string): MarkdownPlateValue {
  if (!markdown.trim()) {
    return emptyMarkdownPlateValue();
  }

  const editor = createMarkdownPlateEditor();
  const value = editor.api.markdown.deserialize(markdown, {
    withoutMdx: true,
  });

  return normalizeMarkdownPlateValue(value);
}

export function serializePlateValueToMarkdown(value: unknown): string {
  const normalizedValue = normalizeMarkdownPlateValue(value);

  if (isEmptyParagraphValue(normalizedValue)) {
    return "";
  }

  const editor = createMarkdownPlateEditor();

  return editor.api.markdown.serialize({ value: normalizedValue as Value }).trimEnd();
}

export function normalizeMarkdownPlateValue(value: unknown): MarkdownPlateValue {
  if (!Array.isArray(value)) {
    return emptyMarkdownPlateValue();
  }

  const normalizedValue = value
    .map((node) => normalizeTopLevelNode(node))
    .filter((node): node is MarkdownPlateElementNode => node !== null);

  return normalizedValue.length > 0 ? normalizedValue : emptyMarkdownPlateValue();
}

function normalizeTopLevelNode(node: unknown): MarkdownPlateElementNode | null {
  const normalizedNode = normalizePlateNode(node);

  if (!normalizedNode) {
    return null;
  }

  if (isMarkdownPlateTextNode(normalizedNode)) {
    return {
      children: [normalizedNode],
      type: "p",
    };
  }

  return normalizedNode;
}

function normalizePlateNode(node: unknown): MarkdownPlateNode | null {
  if (!isRecord(node)) {
    return null;
  }

  if (typeof node.text === "string") {
    return {
      ...node,
      text: node.text,
    };
  }

  if (!Array.isArray(node.children)) {
    return null;
  }

  const children = node.children
    .map((child) => normalizePlateNode(child))
    .filter((child): child is MarkdownPlateNode => child !== null);

  return {
    ...node,
    children: children.length > 0 ? children : [{ text: "" }],
    type: typeof node.type === "string" ? node.type : "p",
  };
}

function isEmptyParagraphValue(value: MarkdownPlateValue): boolean {
  const paragraph = value[0];
  const child = paragraph?.children[0];

  return (
    value.length === 1 &&
    paragraph?.type === "p" &&
    paragraph.children.length === 1 &&
    child !== undefined &&
    isMarkdownPlateTextNode(child) &&
    child.text === ""
  );
}

function isMarkdownPlateTextNode(node: MarkdownPlateNode): node is MarkdownPlateTextNode {
  return "text" in node;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
