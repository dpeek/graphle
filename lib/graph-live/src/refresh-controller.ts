import { type GraphClientSyncController } from "@io/graph-client";
import {
  matchesModuleReadScopeRequest,
  type ModuleReadScopeDefinition,
} from "@io/graph-projection";
import { type SyncPayload, type SyncState } from "@io/graph-sync";

import {
  requestLiveScope,
  type LiveScopeClientOptions,
  type LiveScopeInvalidation,
  type LiveScopePullResult,
  type LiveScopeRegistration,
  type RemoveLiveScopeResponse,
} from "./live-scope.js";

export type ModuleLiveScopeRefreshAction =
  | "none"
  | "scoped-refresh"
  | "reregister-and-scoped-refresh";

export type ModuleLiveScopeRefreshResult = {
  readonly action: ModuleLiveScopeRefreshAction;
  readonly invalidations: readonly LiveScopeInvalidation[];
  readonly live: LiveScopePullResult;
  readonly registration?: LiveScopeRegistration;
  readonly syncResult?: SyncPayload;
};

export type ModuleLiveScopeRefreshController = {
  register(): Promise<LiveScopeRegistration>;
  poll(): Promise<ModuleLiveScopeRefreshResult>;
  remove(): Promise<RemoveLiveScopeResponse["result"]>;
};

type LiveScopeSyncController = Pick<GraphClientSyncController, "getState" | "sync">;

function isActiveModuleLiveScope(
  state: Pick<SyncState, "requestedScope" | "scope">,
  scopeDefinition: Pick<ModuleReadScopeDefinition, "moduleId" | "scopeId">,
): boolean {
  return (
    matchesModuleReadScopeRequest(state.requestedScope, scopeDefinition) &&
    matchesModuleReadScopeRequest(state.scope, scopeDefinition)
  );
}

function readModuleLiveScopeCursor(
  state: Pick<SyncState, "requestedScope" | "scope"> & {
    cursor?: SyncState["cursor"];
  },
  scopeDefinition: Pick<ModuleReadScopeDefinition, "moduleId" | "scopeId">,
): string {
  if (!isActiveModuleLiveScope(state, scopeDefinition)) {
    throw new Error(
      `Live scope refresh requires the "${scopeDefinition.scopeId}" module scope to stay active.`,
    );
  }
  if (typeof state.cursor !== "string" || state.cursor.length === 0) {
    throw new Error(`Live scope refresh requires the current "${scopeDefinition.scopeId}" cursor.`);
  }

  return state.cursor;
}

function readModuleLiveScopeId(
  state: Pick<SyncState, "requestedScope" | "scope">,
  scopeDefinition: Pick<ModuleReadScopeDefinition, "scopeId" | "moduleId">,
): string {
  if (!isActiveModuleLiveScope(state, scopeDefinition)) {
    throw new Error(
      `Live scope refresh requires the "${scopeDefinition.scopeId}" module scope to stay active.`,
    );
  }

  return scopeDefinition.scopeId;
}

function hasCursorAdvancedInvalidation(invalidations: readonly LiveScopeInvalidation[]): boolean {
  return invalidations.some((invalidation) => invalidation.delivery.kind === "cursor-advanced");
}

export function createModuleLiveScopeRefreshController(
  sync: LiveScopeSyncController,
  scopeDefinition: Pick<ModuleReadScopeDefinition, "moduleId" | "scopeId">,
  options: LiveScopeClientOptions = {},
): ModuleLiveScopeRefreshController {
  async function register(): Promise<LiveScopeRegistration> {
    const cursor = readModuleLiveScopeCursor(sync.getState(), scopeDefinition);
    const response = await requestLiveScope(
      {
        kind: "register",
        cursor,
      },
      options,
    );

    return response.result;
  }

  return {
    register,
    async poll() {
      const scopeId = readModuleLiveScopeId(sync.getState(), scopeDefinition);
      const response = await requestLiveScope(
        {
          kind: "pull",
          scopeId,
        },
        options,
      );
      const live = response.result;

      if (!live.active) {
        const registration = await register();
        const syncResult = await sync.sync();
        return Object.freeze({
          action: "reregister-and-scoped-refresh",
          invalidations: Object.freeze([...live.invalidations]),
          live,
          registration,
          syncResult,
        });
      }

      if (hasCursorAdvancedInvalidation(live.invalidations)) {
        const syncResult = await sync.sync();
        return Object.freeze({
          action: "scoped-refresh",
          invalidations: Object.freeze([...live.invalidations]),
          live,
          syncResult,
        });
      }

      return Object.freeze({
        action: "none",
        invalidations: Object.freeze([...live.invalidations]),
        live,
      });
    },
    async remove() {
      const scopeId = readModuleLiveScopeId(sync.getState(), scopeDefinition);
      const response = await requestLiveScope(
        {
          kind: "remove",
          scopeId,
        },
        options,
      );

      return response.result;
    },
  };
}
