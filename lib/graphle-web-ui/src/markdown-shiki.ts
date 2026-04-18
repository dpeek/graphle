import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsonc from "@shikijs/langs/jsonc";
import jsx from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/markdown";
import mdx from "@shikijs/langs/mdx";
import scss from "@shikijs/langs/scss";
import sql from "@shikijs/langs/sql";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { isSupportedHighlightLanguage } from "./markdown-code-info.js";

const highlighterPromise = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: [
    bash,
    css,
    diff,
    html,
    javascript,
    json,
    jsonc,
    jsx,
    markdown,
    mdx,
    scss,
    sql,
    tsx,
    typescript,
    yaml,
  ],
  themes: [githubLight, githubDark],
});

export type HighlightMarkdownCodeResult =
  | { html: string; status: "highlighted" }
  | { error?: unknown; status: "plain" };

export async function highlightMarkdownCode(
  code: string,
  language: string,
): Promise<HighlightMarkdownCodeResult> {
  if (!isSupportedHighlightLanguage(language)) {
    return { status: "plain" };
  }

  try {
    const highlighter = await highlighterPromise;
    const html = highlighter.codeToHtml(code, {
      defaultColor: false,
      lang: language,
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    });

    return { html, status: "highlighted" };
  } catch (error) {
    return { error, status: "plain" };
  }
}
