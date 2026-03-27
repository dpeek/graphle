import type { AnyTypeOutput, EdgeOutput } from "@io/graph-kernel";
import {
  PredicateFieldEditor as GraphPredicateFieldEditor,
  PredicateFieldView as GraphPredicateFieldView,
  createGraphFieldResolver,
  type GraphFieldEditorResolution,
  type GraphFieldResolver,
  type GraphFieldViewResolution,
  type PredicateFieldEditorCapability,
  type PredicateFieldEditorProps,
  type PredicateFieldProps,
  type PredicateFieldViewCapability,
  type PredicateFieldViewProps,
  type UnsupportedFieldFallbackProps,
  type UnsupportedFieldReason,
} from "@io/graph-react";
import type { ReactNode } from "react";

import {
  genericWebFieldEditorCapabilities,
  genericWebFieldViewCapabilities,
} from "./field-registry.js";

/**
 * Creates a browser field resolver by layering DOM capabilities over the
 * host-neutral `@io/graph-react` resolver contracts.
 */
export const createWebFieldResolver = createGraphFieldResolver;
export type {
  PredicateFieldEditorCapability,
  PredicateFieldProps,
  PredicateFieldViewCapability,
  UnsupportedFieldReason,
};
export type WebFieldEditorResolution<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
> = GraphFieldEditorResolution<T, Defs>;
export type WebFieldResolver = GraphFieldResolver;
export type WebFieldViewResolution<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
> = GraphFieldViewResolution<T, Defs>;

/** Default browser resolver for the built-in DOM field capabilities. */
export const defaultWebFieldResolver = createWebFieldResolver({
  view: genericWebFieldViewCapabilities,
  editor: genericWebFieldEditorCapabilities,
});

function UnsupportedField({ kind, reason }: UnsupportedFieldFallbackProps): ReactNode {
  return <span data-web-field-status="unsupported">{kind ? `${reason}:${kind}` : reason}</span>;
}

/** Browser fallback wrapper over the host-neutral `PredicateFieldView`. */
export function PredicateFieldView<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
>({ fallback, resolver = defaultWebFieldResolver, ...props }: PredicateFieldViewProps<T, Defs>) {
  return (
    <GraphPredicateFieldView
      {...props}
      fallback={fallback ?? UnsupportedField}
      resolver={resolver}
    />
  );
}

/** Browser fallback wrapper over the host-neutral `PredicateFieldEditor`. */
export function PredicateFieldEditor<
  T extends EdgeOutput,
  Defs extends Record<string, AnyTypeOutput>,
>({ fallback, resolver = defaultWebFieldResolver, ...props }: PredicateFieldEditorProps<T, Defs>) {
  return (
    <GraphPredicateFieldEditor
      {...props}
      fallback={fallback ?? UnsupportedField}
      resolver={resolver}
    />
  );
}
