import {
  createCoreQueryExecutorRegistrations,
  type CoreQueryExecutorDependencies,
} from "@io/graph-module-core";
import {
  createWorkflowQueryExecutorRegistrations,
  type WorkflowQueryExecutorDependencies,
} from "@io/graph-module-workflow";
import {
  createQueryExecutorRegistry,
  type RegisteredSerializedQueryExecutor,
  type SerializedQueryExecutorRegistry,
} from "@io/graph-query";

import { getInstalledModuleQuerySurfaceRegistry } from "./query-surface-registry.js";

export type WebAppSerializedQueryExecutorDependencies<ReadOptions> =
  CoreQueryExecutorDependencies<ReadOptions> & WorkflowQueryExecutorDependencies<ReadOptions>;

export function createWebAppSerializedQueryExecutorRegistry<ReadOptions>(
  dependencies: WebAppSerializedQueryExecutorDependencies<ReadOptions>,
): SerializedQueryExecutorRegistry<ReadOptions> {
  const surfaceRegistry = getInstalledModuleQuerySurfaceRegistry();
  const executors: readonly RegisteredSerializedQueryExecutor<ReadOptions>[] = [
    ...createWorkflowQueryExecutorRegistrations(dependencies),
    ...createCoreQueryExecutorRegistrations(dependencies),
  ];

  return createQueryExecutorRegistry(surfaceRegistry, executors);
}
