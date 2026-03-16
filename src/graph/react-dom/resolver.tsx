import type { AnyTypeOutput, EdgeOutput } from "../index.js";
import {
  PredicateFieldEditor as GraphPredicateFieldEditor,
  PredicateFieldView as GraphPredicateFieldView,
  createWebFieldResolver,
  type PredicateFieldEditorProps,
  type PredicateFieldViewProps,
  type UnsupportedFieldFallbackProps,
} from "../react/index.js";
import type { ReactNode } from "react";

import {
  genericWebFieldEditorCapabilities,
  genericWebFieldViewCapabilities,
} from "./fields.js";

export { createWebFieldResolver } from "../react/index.js";
export type {
  PredicateFieldEditorCapability,
  PredicateFieldProps,
  PredicateFieldViewCapability,
  UnsupportedFieldReason,
  WebFieldEditorResolution,
  WebFieldResolver,
  WebFieldViewResolution,
} from "../react/index.js";

export const defaultWebFieldResolver = createWebFieldResolver({
  view: genericWebFieldViewCapabilities,
  editor: genericWebFieldEditorCapabilities,
});

function UnsupportedField({ kind, reason }: UnsupportedFieldFallbackProps): ReactNode {
  return <span data-web-field-status="unsupported">{kind ? `${reason}:${kind}` : reason}</span>;
}

export function PredicateFieldView<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
>({
  fallback,
  resolver = defaultWebFieldResolver,
  ...props
}: PredicateFieldViewProps<T, Defs>) {
  return (
    <GraphPredicateFieldView
      {...props}
      fallback={fallback ?? UnsupportedField}
      resolver={resolver}
    />
  );
}

export function PredicateFieldEditor<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
>({
  fallback,
  resolver = defaultWebFieldResolver,
  ...props
}: PredicateFieldEditorProps<T, Defs>) {
  return (
    <GraphPredicateFieldEditor
      {...props}
      fallback={fallback ?? UnsupportedField}
      resolver={resolver}
    />
  );
}
