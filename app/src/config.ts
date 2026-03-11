import { app } from "./graph/app.js";

export const appNamespace = app;

export type AppRuntimeConfig = {
  readonly syncUrl: string;
};

export const defaultAppSyncPath = "/api/sync";
export const appRuntimeConfigGlobalKey = "__IO_APP_CONFIG__";
export const appRuntimeConfigScriptPath = "/app-config.js";

type RuntimeConfigGlobal = typeof globalThis & {
  __IO_APP_CONFIG__?: Partial<AppRuntimeConfig>;
};

function readGlobalRuntimeConfig(): Partial<AppRuntimeConfig> | undefined {
  return (globalThis as RuntimeConfigGlobal)[appRuntimeConfigGlobalKey];
}

export function resolveRuntimeConfigSyncUrl(
  requestUrl: string,
  configuredSyncUrl?: string,
): string {
  const nextSyncUrl = configuredSyncUrl?.trim();
  return new URL(nextSyncUrl && nextSyncUrl.length > 0 ? nextSyncUrl : defaultAppSyncPath, requestUrl).toString();
}

export function resolveBrowserRuntimeConfig(
  locationLike: Pick<Location, "href"> = window.location,
): AppRuntimeConfig {
  return {
    syncUrl: resolveRuntimeConfigSyncUrl(
      locationLike.href,
      readGlobalRuntimeConfig()?.syncUrl,
    ),
  };
}

export function serializeBrowserRuntimeConfig(config: AppRuntimeConfig): string {
  return `globalThis.${appRuntimeConfigGlobalKey} = Object.freeze(${JSON.stringify(config)});\n`;
}
