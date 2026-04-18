"use client";

import { Button } from "@dpeek/graphle-web-ui/button";
import { TextTooltip } from "@dpeek/graphle-web-ui/tooltip";
import { cn } from "@dpeek/graphle-web-ui/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { parseMarkdownCodeInfo } from "./markdown-code-info.js";

type MarkdownCodeBlockProps = {
  className?: string;
  code: string;
  language?: string | null;
  meta?: string | null;
};

type MarkdownShikiModule = typeof import("./markdown-shiki.js");

let markdownShikiModulePromise: Promise<MarkdownShikiModule> | null = null;

function loadMarkdownShiki(): Promise<MarkdownShikiModule> {
  markdownShikiModulePromise ??= import("./markdown-shiki.js");

  return markdownShikiModulePromise;
}

export function MarkdownCodeBlock({ className, code, language, meta }: MarkdownCodeBlockProps) {
  const codeInfo = useMemo(() => parseMarkdownCodeInfo({ language, meta }), [language, meta]);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!codeInfo.highlightLanguage) {
      setHighlightedHtml(null);
      return;
    }

    let cancelled = false;

    setHighlightedHtml(null);
    void loadMarkdownShiki()
      .then(({ highlightMarkdownCode }) => highlightMarkdownCode(code, codeInfo.highlightLanguage!))
      .then((result) => {
        if (!cancelled) {
          setHighlightedHtml(result.status === "highlighted" ? result.html : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, codeInfo.highlightLanguage]);

  return (
    <div
      className={cn("not-prose graph-markdown-code-block", className)}
      data-code-block="true"
      data-language={codeInfo.language ?? undefined}
    >
      <div className="graph-markdown-code-block-header">
        {codeInfo.label ? (
          <span className="graph-markdown-code-block-label">{codeInfo.label}</span>
        ) : (
          <span aria-hidden="true" />
        )}
        <MarkdownCodeCopyButton code={code} />
      </div>
      <div className="graph-markdown-code-block-body">
        {highlightedHtml ? (
          <div
            className="graph-markdown-code-block-highlight"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="graph-markdown-code-block-pre">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

function MarkdownCodeCopyButton({ code }: { code: string }) {
  const [copyState, setCopyState] = useState<"copied" | "failed" | "idle">("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyState]);

  const label =
    copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy code";

  async function copyCode(): Promise<void> {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <MarkdownCodeTooltip text={label}>
      <Button
        aria-label={label}
        className="graph-markdown-code-block-copy-button"
        onClick={() => void copyCode()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </MarkdownCodeTooltip>
  );
}

function MarkdownCodeTooltip({ children, text }: { children: ReactNode; text: string }) {
  if (typeof document === "undefined") {
    return <>{children}</>;
  }

  return <TextTooltip text={text}>{children}</TextTooltip>;
}
