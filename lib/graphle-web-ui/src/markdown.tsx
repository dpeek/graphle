"use client";

import { cn } from "@dpeek/graphle-web-ui/utils";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";

import { MarkdownCodeBlock } from "./markdown-code-block.js";

type HastNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type?: string;
  value?: string;
};

type MarkdownAstNode = {
  children?: MarkdownAstNode[];
  data?: {
    hProperties?: Record<string, unknown>;
  };
  lang?: string | null;
  meta?: string | null;
  type?: string;
};

const markdownComponents = {
  code({ node: _, ...props }: ComponentPropsWithoutRef<"code"> & ExtraProps) {
    return <code {...props} />;
  },
  pre({ children, node, ...props }: ComponentPropsWithoutRef<"pre"> & ExtraProps) {
    const codeNode = findCodeElement(node as HastNode | undefined);

    if (!codeNode) {
      return <pre {...props}>{children}</pre>;
    }

    return (
      <MarkdownCodeBlock
        code={codeTextFromElement(codeNode)}
        language={stringProperty(codeNode.properties, "data-language")}
        meta={stringProperty(codeNode.properties, "data-meta")}
      />
    );
  },
};

export function MarkdownRenderer({ className, content }: { className?: string; content: string }) {
  return (
    <div
      className={cn("graph-markdown prose max-w-none dark:prose-invert", className)}
      data-web-markdown-renderer="react-markdown"
    >
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeSlug]}
        remarkPlugins={[remarkGfm, remarkCodeBlockMetadata]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function remarkCodeBlockMetadata() {
  return (tree: MarkdownAstNode) => {
    visitCodeNodes(tree, (node) => {
      node.data ??= {};
      node.data.hProperties ??= {};
      node.data.hProperties["data-code-block"] = "true";

      if (node.lang) {
        node.data.hProperties["data-language"] = node.lang;
      }

      if (node.meta) {
        node.data.hProperties["data-meta"] = node.meta;
      }
    });
  };
}

function visitCodeNodes(node: MarkdownAstNode, visitor: (node: MarkdownAstNode) => void): void {
  if (node.type === "code") {
    visitor(node);
  }

  for (const child of node.children ?? []) {
    visitCodeNodes(child, visitor);
  }
}

function findCodeElement(node: HastNode | undefined): HastNode | null {
  return (
    node?.children?.find((child) => child.type === "element" && child.tagName === "code") ?? null
  );
}

function codeTextFromElement(node: HastNode): string {
  return stripHtmlCodeBlockNewline(collectText(node));
}

function collectText(node: HastNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }

  return node.children?.map(collectText).join("") ?? "";
}

function stripHtmlCodeBlockNewline(code: string): string {
  return code.endsWith("\n") ? code.slice(0, -1) : code;
}

function stringProperty(
  properties: Record<string, unknown> | undefined,
  name: string,
): string | null {
  const value = properties?.[name] ?? properties?.[camelCaseDataName(name)];

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function camelCaseDataName(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
