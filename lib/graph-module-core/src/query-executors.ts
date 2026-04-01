import type { QueryResultPage } from "@io/graph-client";

import { coreBuiltInQuerySurfaces } from "./query.js";

export type CoreQueryExecutorDependencies<ReadOptions> = {
  readonly executeModuleScopeQuery: (context: any) => QueryResultPage;
  readonly unsupported: (message: string) => Error;
};

type CoreQueryExecutorRegistration<ReadOptions> = {
  readonly execute: (context: any) => QueryResultPage;
  readonly queryKind: "scope";
  readonly surfaceId: string;
  readonly surfaceVersion: string;
};

function createCoreModuleScopeExecutor<ReadOptions>(
  surface: Pick<CoreQueryExecutorRegistration<ReadOptions>, "surfaceId" | "surfaceVersion">,
  dependencies: CoreQueryExecutorDependencies<ReadOptions>,
): CoreQueryExecutorRegistration<ReadOptions> {
  return {
    queryKind: "scope",
    surfaceId: surface.surfaceId,
    surfaceVersion: surface.surfaceVersion,
    execute(context) {
      if (context.normalizedRequest.query.window) {
        throw dependencies.unsupported(
          `Scope query "${context.normalizedRequest.query.scopeId ?? "inline"}" does not support windowed pagination.`,
        );
      }

      return dependencies.executeModuleScopeQuery(context);
    },
  };
}

export function createCoreQueryExecutorRegistrations<ReadOptions>(
  dependencies: CoreQueryExecutorDependencies<ReadOptions>,
): readonly CoreQueryExecutorRegistration<ReadOptions>[] {
  return [createCoreModuleScopeExecutor(coreBuiltInQuerySurfaces.catalogScope, dependencies)];
}
