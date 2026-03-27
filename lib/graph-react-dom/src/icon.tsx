import { sanitizeSvgMarkup } from "@io/core/graph";
import { cn } from "@io/web/utils";
import type { ReactNode } from "react";

export type SvgMarkupProps = {
  className?: string;
  data?: Record<`data-${string}`, string>;
  fallback?: ReactNode;
  svg: string;
  title?: string;
};

function injectRootSvgClass(svg: string): string {
  return svg.replace(/^<svg(?=[\s>])/, '<svg class="block size-full shrink-0 overflow-visible"');
}

/** Renders sanitized SVG markup with the browser adapter's default sizing chrome. */
export function SvgMarkup({ className, data, fallback, svg, title }: SvgMarkupProps) {
  const result = sanitizeSvgMarkup(svg);
  if (!result.ok) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-visible p-px [&>svg]:block [&>svg]:size-full [&>svg]:shrink-0 [&>svg]:overflow-visible",
        className,
      )}
      {...data}
      data-graph-svg-state="ready"
      role={title ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: injectRootSvgClass(result.svg) }}
    />
  );
}
