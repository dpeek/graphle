import { afterEach, describe, expect, it } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

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
  it("uses Bun markdown when available", () => {
    setBunMarkdown({
      react(content: string) {
        return <article data-bun-rendered="true">{content.toUpperCase()}</article>;
      },
    } as unknown as BunMarkdownApi);

    const markup = renderToStaticMarkup(<MarkdownRenderer content="hello world" />);

    expect(markup).toContain("graph-markdown");
    expect(markup).toContain("prose");
    expect(markup).toContain("max-w-none");
    expect(markup).toContain("dark:prose-invert");
    expect(markup).toContain('data-web-markdown-renderer="bun"');
    expect(markup).toContain('data-bun-rendered="true"');
    expect(markup).toContain("HELLO WORLD");
  });

  it("falls back to react-markdown when Bun markdown is unavailable", () => {
    setBunMarkdown(undefined);

    const markup = renderToStaticMarkup(
      <MarkdownRenderer content={"# Heading\n\n[example](https://example.com)"} />,
    );

    expect(markup).toContain('data-web-markdown-renderer="react-markdown"');
    expect(markup).toContain("graph-markdown");
    expect(markup).toContain("prose");
    expect(markup).toContain("<h1>Heading</h1>");
    expect(markup).toContain('<a href="https://example.com">example</a>');
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
