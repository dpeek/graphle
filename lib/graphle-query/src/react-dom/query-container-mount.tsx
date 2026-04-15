"use client";

import type {
  QueryContainerPageExecutor,
  QueryContainerRuntimeController,
  QueryContainerSourceResolver,
  QueryContainerRuntimeValue,
  QueryContainerSpec,
  QuerySurfaceRendererCompatibility,
} from "../query-container.js";
import { QueryContainerSurface, QueryContainerSurfaceView } from "./query-container-surface.js";
import type { QueryRendererRegistry } from "./query-renderers.js";

export type QueryContainerMountProps = {
  readonly description?: string;
  readonly executePage?: QueryContainerPageExecutor;
  readonly initialValue?: QueryContainerRuntimeValue;
  readonly registry?: QueryRendererRegistry;
  readonly resolveSource?: QueryContainerSourceResolver;
  readonly runtime?: QueryContainerRuntimeController;
  readonly spec: QueryContainerSpec;
  readonly surface?: QuerySurfaceRendererCompatibility;
  readonly title: string;
};

export function QueryContainerMountView({
  description,
  initialValue,
  registry,
  spec,
  surface,
  title,
}: Omit<QueryContainerMountProps, "executePage" | "resolveSource" | "runtime">) {
  return (
    <section className="grid gap-3" data-query-container-mount={spec.containerId}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
        ) : null}
      </div>
      <QueryContainerSurfaceView
        description={description}
        registry={registry}
        spec={spec}
        surface={surface}
        title={title}
        value={initialValue}
      />
    </section>
  );
}

export function QueryContainerMount({
  description,
  executePage,
  initialValue,
  registry,
  resolveSource,
  runtime,
  spec,
  surface,
  title,
}: QueryContainerMountProps) {
  return (
    <section className="grid gap-3" data-query-container-mount={spec.containerId}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
        ) : null}
      </div>
      <QueryContainerSurface
        description={description}
        executePage={executePage}
        initialValue={initialValue}
        registry={registry}
        resolveSource={resolveSource}
        runtime={runtime}
        spec={spec}
        surface={surface}
        title={title}
      />
    </section>
  );
}
