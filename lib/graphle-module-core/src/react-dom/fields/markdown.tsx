import {
  getPredicateEditorPlaceholder,
  performValidatedMutation,
  usePredicateField,
  type PredicateFieldViewCapability,
} from "@dpeek/graphle-react";
import { MarkdownRenderer } from "@dpeek/graphle-web-ui/markdown";
import { MonacoSourceEditor, sourcePreviewMonacoOptions } from "@dpeek/graphle-web-ui/monaco";
import { useEffect, useState } from "react";

import {
  normalizeTextValue,
  setPredicateValue,
  useFieldMutationCallbacks,
  validatePredicateValue,
  type AnyFieldProps,
} from "./shared.js";

function MarkdownFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  const content = normalizeTextValue(value);

  return (
    <div data-web-field-kind="markdown">
      <MarkdownRenderer content={content} />
    </div>
  );
}

export const markdownFieldViewCapability = {
  kind: "markdown",
  Component: MarkdownFieldView,
} satisfies PredicateFieldViewCapability<any, any>;

export function MarkdownFieldEditor({
  onMutationError,
  onMutationSuccess,
  predicate,
}: AnyFieldProps) {
  const callbacks = useFieldMutationCallbacks({ onMutationError, onMutationSuccess });
  const { value } = usePredicateField(predicate);
  const placeholder = getPredicateEditorPlaceholder(predicate.field);
  const committedValue = normalizeTextValue(value);
  const [draft, setDraft] = useState(committedValue);
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    setDraft(committedValue);
    setIsInvalid(false);
  }, [committedValue]);

  function applyDraft(nextValue: string): void {
    setDraft(nextValue);
    const committed = performValidatedMutation(
      callbacks,
      () => validatePredicateValue(predicate, nextValue),
      () => setPredicateValue(predicate, nextValue),
    );
    setIsInvalid(!committed);
  }

  return (
    <div aria-invalid={isInvalid || undefined} data-web-field-kind="markdown">
      <MonacoSourceEditor
        language="markdown"
        onChange={applyDraft}
        options={sourcePreviewMonacoOptions}
        placeholder={placeholder}
        sourceKind="markdown"
        value={draft}
      />
    </div>
  );
}
