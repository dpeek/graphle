import { afterEach, describe, expect, it } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { parseMarkdownCodeInfo } from "./markdown-code-info.js";
import { highlightMarkdownCode } from "./markdown-shiki.js";
import { MarkdownRenderer } from "./markdown.js";

type BunMarkdownApi = typeof Bun.markdown;

const originalBunMarkdown = Bun.markdown;

function setBunMarkdown(markdown: BunMarkdownApi | undefined) {
  Reflect.set(Bun as Record<string, unknown>, "markdown", markdown);
}

afterEach(() => {
  setBunMarkdown(originalBunMarkdown);
});

describe("MarkdownRenderer", () => {
  it("uses the react-markdown pipeline even when Bun markdown is available", () => {
    setBunMarkdown({
      react(content: string) {
        return <article data-bun-rendered="true">{content.toUpperCase()}</article>;
      },
    } as unknown as BunMarkdownApi);

    const markup = renderToStaticMarkup(<MarkdownRenderer content="# Heading" />);

    expect(markup).toContain("graph-markdown");
    expect(markup).toContain("prose");
    expect(markup).toContain("max-w-none");
    expect(markup).toContain("dark:prose-invert");
    expect(markup).toContain('data-web-markdown-renderer="react-markdown"');
    expect(markup).toContain('<h1 id="heading">Heading</h1>');
    expect(markup).not.toContain("data-bun-rendered");
  });

  it("renders GFM tables, task lists, strikethrough, and literal autolinks", () => {
    const markup = renderToStaticMarkup(
      <MarkdownRenderer
        content={[
          "www.example.com",
          "",
          "- [x] shipped",
          "",
          "~~removed~~",
          "",
          "| Name | Value |",
          "| --- | --- |",
          "| a | b |",
        ].join("\n")}
      />,
    );

    expect(markup).toContain('<a href="http://www.example.com">www.example.com</a>');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("checked");
    expect(markup).toContain("<del>removed</del>");
    expect(markup).toContain("<table>");
    expect(markup).toContain("<td>b</td>");
  });

  it("keeps inline code as prose inline code", () => {
    const markup = renderToStaticMarkup(<MarkdownRenderer content="Use `value` inline." />);

    expect(markup).toContain("<code>value</code>");
    expect(markup).not.toContain("graph-markdown-code-block");
    expect(markup).not.toContain('data-code-block="true"');
  });

  it("renders fenced code blocks with labels, copy controls, and plain SSR code", () => {
    const markup = renderToStaticMarkup(
      <MarkdownRenderer
        content={[
          '```tsx filename="lib/graphle-web-ui/src/markdown.tsx"',
          "const value = 1;",
          "```",
        ].join("\n")}
      />,
    );

    expect(markup).toContain("graph-markdown-code-block");
    expect(markup).toContain('data-code-block="true"');
    expect(markup).toContain('data-language="tsx"');
    expect(markup).toContain("lib/graphle-web-ui/src/markdown.tsx");
    expect(markup).toContain('aria-label="Copy code"');
    expect(markup).toContain("<code>const value = 1;</code>");
  });

  it("keeps caller class names for layout without replacing markdown styles", () => {
    const markup = renderToStaticMarkup(
      <MarkdownRenderer className="max-w-[48rem]" content="hello world" />,
    );

    expect(markup).toContain("graph-markdown");
    expect(markup).toContain("prose");
    expect(markup).toContain("max-w-[48rem]");
    expect(markup).not.toContain("max-w-none");
  });
});

describe("parseMarkdownCodeInfo", () => {
  it("reads explicit filename metadata and normalizes language aliases", () => {
    expect(parseMarkdownCodeInfo({ language: "ts", meta: 'filename="schema.ts"' })).toEqual({
      filename: "schema.ts",
      highlightLanguage: "typescript",
      label: "schema.ts",
      language: "typescript",
    });
  });

  it("infers language from path-like first tokens", () => {
    expect(parseMarkdownCodeInfo({ language: "lib/graphle-web-ui/src/markdown.tsx" })).toEqual({
      filename: "lib/graphle-web-ui/src/markdown.tsx",
      highlightLanguage: "tsx",
      label: "lib/graphle-web-ui/src/markdown.tsx",
      language: "tsx",
    });
  });

  it("renders unknown languages as plain code while preserving the visible label", () => {
    expect(parseMarkdownCodeInfo({ language: "mermaid" })).toEqual({
      filename: null,
      highlightLanguage: null,
      label: "mermaid",
      language: "mermaid",
    });
  });

  it("skips highlighting for plain-text aliases", () => {
    expect(parseMarkdownCodeInfo({ language: "nohighlight" })).toEqual({
      filename: null,
      highlightLanguage: null,
      label: "Text",
      language: "text",
    });
  });
});

describe("highlightMarkdownCode", () => {
  it("returns dual-theme Shiki HTML for supported languages", async () => {
    const result = await highlightMarkdownCode("const value = 1;", "typescript");

    expect(result.status).toBe("highlighted");

    if (result.status === "highlighted") {
      expect(result.html).toContain("shiki");
      expect(result.html).toContain("--shiki-light");
      expect(result.html).toContain("--shiki-dark");
    }
  });

  it("falls back to plain rendering for unsupported languages", async () => {
    await expect(highlightMarkdownCode("graph TD;", "mermaid")).resolves.toEqual({
      status: "plain",
    });
  });
});
