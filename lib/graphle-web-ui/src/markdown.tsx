"use client";

import { cn } from "@dpeek/graphle-web-ui/utils";
import { useEffect, useMemo, useRef } from "react";
import { type Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { createStaticEditor, PlateStatic } from "platejs/static";

import { MarkdownFloatingToolbar } from "./markdown-floating-toolbar.js";
import {
  markdownPlateComponents,
  markdownPlateEditorComponents,
} from "./markdown-plate-components.js";
import { createMarkdownPlatePlugins } from "./markdown-plate-kit.js";
import {
  decorateMarkdownPlateValue,
  deserializeMarkdownToPlateValue,
  serializePlateValueToMarkdown,
  type MarkdownPlateValue,
} from "./markdown-plate-value.js";

export function MarkdownRenderer({ className, content }: { className?: string; content: string }) {
  const value = useMemo(
    () => decorateMarkdownPlateValue(deserializeMarkdownToPlateValue(content), content),
    [content],
  );
  const editor = useMemo(
    () =>
      createStaticEditor({
        components: markdownPlateComponents,
        plugins: createMarkdownPlatePlugins(),
        value,
      }),
    [value],
  );

  return (
    <PlateStatic
      className={cn("graph-markdown prose max-w-none dark:prose-invert", className)}
      data-web-markdown-renderer="plate"
      editor={editor}
    />
  );
}

export function MarkdownEditor({
  "aria-invalid": ariaInvalid,
  className,
  onChange,
  placeholder,
  value,
}: {
  "aria-invalid"?: boolean;
  className?: string;
  onChange(nextMarkdown: string): void;
  placeholder?: string;
  value: string;
}) {
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef<MarkdownPlateValue | null>(null);
  const lastEmittedMarkdownRef = useRef<string | null>(null);
  const lastPropValueRef = useRef(value);
  const suppressChangeRef = useRef(false);

  if (initialValueRef.current === null) {
    initialValueRef.current = markdownStringToPlateValue(value);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = usePlateEditor({
    components: markdownPlateEditorComponents,
    plugins: createMarkdownPlatePlugins(),
    value: initialValueRef.current,
  });

  useEffect(() => {
    if (value === lastPropValueRef.current) {
      return;
    }

    lastPropValueRef.current = value;

    if (value === lastEmittedMarkdownRef.current) {
      return;
    }

    suppressChangeRef.current = true;
    editor.tf.setValue(markdownStringToPlateValue(value) as Value);
    editor.operations = [];
    editor.marks = null;

    if (editor.history) {
      editor.history.undos = [];
      editor.history.redos = [];
    }

    suppressChangeRef.current = false;
  }, [editor, value]);

  return (
    <Plate
      editor={editor}
      onValueChange={({ value }) => {
        if (suppressChangeRef.current) {
          return;
        }

        const nextMarkdown = serializePlateValueToMarkdown(value);

        lastEmittedMarkdownRef.current = nextMarkdown;
        onChangeRef.current(nextMarkdown);
      }}
    >
      <PlateContent
        aria-invalid={ariaInvalid || undefined}
        className={cn(
          "graph-markdown graph-markdown-editor prose max-w-none dark:prose-invert",
          className,
        )}
        data-web-markdown-editor="plate"
        placeholder={placeholder}
      />
      <MarkdownFloatingToolbar />
    </Plate>
  );
}

function markdownStringToPlateValue(markdown: string): MarkdownPlateValue {
  return decorateMarkdownPlateValue(deserializeMarkdownToPlateValue(markdown), markdown);
}
