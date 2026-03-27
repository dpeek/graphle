import { useOptionalMutationRuntime, usePredicateField } from "@io/graph-react";
import { SvgMarkup } from "@io/graph-react-dom";
import type { ReactNode } from "react";

type GraphIconHandle = {
  fields: {
    name: unknown;
    svg: unknown;
  };
};

type GraphIconRuntime = {
  graph?: {
    icon?: {
      ref(id: string): GraphIconHandle;
    };
  };
};

export type GraphIconProps = {
  className?: string;
  fallback?: ReactNode;
  iconId?: string;
  title?: string;
};

/**
 * Resolves and renders the current built-in core icon entity shape through the
 * active graph mutation runtime. Callers with a different icon contract should
 * provide their own wrapper.
 */
export function GraphIcon({ className, fallback, iconId, title }: GraphIconProps) {
  const runtime = useOptionalMutationRuntime() as GraphIconRuntime | null;

  if (!iconId) {
    return fallback ? <>{fallback}</> : null;
  }

  const iconRef = runtime?.graph?.icon?.ref(iconId);
  if (!iconRef) {
    return fallback ? <>{fallback}</> : null;
  }

  const { value: svg } = usePredicateField(iconRef.fields.svg as never);
  const { value: name } = usePredicateField(iconRef.fields.name as never);
  if (typeof svg !== "string" || svg.length === 0) {
    return fallback ? <>{fallback}</> : null;
  }

  const resolvedTitle = title ?? (typeof name === "string" && name.length > 0 ? name : undefined);
  return (
    <SvgMarkup
      className={className}
      data={{ "data-graph-icon": iconId, "data-graph-icon-state": "ready" }}
      fallback={fallback}
      svg={svg}
      title={resolvedTitle}
    />
  );
}
