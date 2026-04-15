import {
  queryParameterTypeValues,
  validateSerializedQueryRequest,
  type QueryLiteral,
  type QueryParameterDefinition,
  type QueryParameterType,
  type SerializedQueryRequest,
} from "../../../graphle-client/src/index.js";
import { existingEntityReferenceField } from "../../../graphle-module/src/index.js";
import { defineType } from "../../../graphle-module/src/index.js";

import { booleanTypeModule } from "./boolean.js";
import { jsonTypeModule } from "./json.js";
import { node } from "./node.js";
import { numberTypeModule } from "./number.js";
import { stringTypeModule } from "./string.js";

export const savedQueryKindValues = ["entity", "neighborhood", "collection", "scope"] as const;

export type SavedQueryKind = (typeof savedQueryKindValues)[number];

export const savedViewPaginationModeValues = ["paged", "infinite"] as const;

export type SavedViewPaginationMode = (typeof savedViewPaginationModeValues)[number];

export const savedViewRefreshModeValues = ["manual", "poll", "push"] as const;

export type SavedViewRefreshMode = (typeof savedViewRefreshModeValues)[number];

export type SavedQuerySurfaceBinding = {
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly moduleId: string;
  readonly surfaceId: string;
  readonly surfaceVersion: string;
};

export type SavedViewRendererFieldDefinition = {
  readonly emptyLabel?: string;
  readonly fieldId: string;
  readonly label?: string;
};

export type SavedViewListRendererDefinition = {
  readonly badgeField?: string;
  readonly descriptionField?: string;
  readonly metaFields?: readonly SavedViewRendererFieldDefinition[];
  readonly titleField?: string;
};

export type SavedViewTableRendererColumnDefinition = SavedViewRendererFieldDefinition & {
  readonly align?: "center" | "end" | "start";
};

export type SavedViewCardRendererDefinition = {
  readonly badgeField?: string;
  readonly descriptionField?: string;
  readonly fields?: readonly SavedViewRendererFieldDefinition[];
  readonly titleField?: string;
};

export type SavedViewRendererDefinition =
  | {
      readonly item: SavedViewListRendererDefinition;
      readonly kind: "list";
    }
  | {
      readonly card: SavedViewCardRendererDefinition;
      readonly kind: "card-grid";
    }
  | {
      readonly columns: readonly SavedViewTableRendererColumnDefinition[];
      readonly kind: "table";
    };

export type SavedViewContainerDefaults = {
  readonly pagination?: {
    readonly mode: SavedViewPaginationMode;
    readonly pageSize: number;
  };
  readonly refresh?: {
    readonly mode: SavedViewRefreshMode;
    readonly pollIntervalMs?: number;
  };
};

export type SavedQueryDefinition = {
  readonly createdAt: Date;
  readonly definitionHash: string;
  readonly description?: string;
  readonly id: string;
  readonly kind: SavedQueryKind;
  readonly name: string;
  readonly ownerId: string;
  readonly parameterDefinitions: readonly QueryParameterDefinition[];
  readonly request: SerializedQueryRequest;
  readonly surface?: SavedQuerySurfaceBinding;
  readonly updatedAt: Date;
};

export type SavedQueryDefinitionInput = {
  readonly description?: string;
  readonly name: string;
  readonly ownerId: string;
  readonly parameterDefinitions?: readonly QueryParameterDefinition[];
  readonly request: SerializedQueryRequest;
  readonly surface?: SavedQuerySurfaceBinding;
};

export type SavedViewDefinition = {
  readonly containerId: string;
  readonly containerDefaults?: SavedViewContainerDefaults;
  readonly createdAt: Date;
  readonly description?: string;
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly queryId: string;
  readonly queryParams?: Readonly<Record<string, QueryLiteral>>;
  readonly rendererDefinition?: SavedViewRendererDefinition;
  readonly rendererId: string;
  readonly updatedAt: Date;
};

export type SavedViewDefinitionInput = {
  readonly containerId: string;
  readonly containerDefaults?: SavedViewContainerDefaults;
  readonly description?: string;
  readonly name: string;
  readonly ownerId: string;
  readonly queryId: string;
  readonly queryParams?: Readonly<Record<string, QueryLiteral>>;
  readonly rendererDefinition?: SavedViewRendererDefinition;
  readonly rendererId: string;
};

export class SavedQueryDefinitionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SavedQueryDefinitionError";
  }
}

function validateRequiredString(label: string, value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? undefined
    : {
        code: "string.blank",
        message: `${label} must not be blank.`,
      };
}

function validatePositiveInteger(label: string, value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? undefined
    : {
        code: "number.invalid",
        message: `${label} must be a positive integer.`,
      };
}

function validateAllowedValue<T extends readonly string[]>(
  label: string,
  value: unknown,
  allowed: T,
): { code: string; message: string } | undefined {
  return typeof value === "string" && allowed.includes(value)
    ? undefined
    : {
        code: "string.invalid",
        message: `${label} must be one of: ${allowed.join(", ")}.`,
      };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isQueryLiteral(value: unknown): value is QueryLiteral {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  const first = typeof value[0];
  if (!["string", "number", "boolean"].includes(first)) {
    return false;
  }
  return value.every((entry) => typeof entry === first);
}

function isQueryLiteralMap(value: unknown): value is Readonly<Record<string, QueryLiteral>> {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(
    ([key, entry]) => key.trim().length > 0 && isQueryLiteral(entry),
  );
}

function validateQueryLiteralMap(label: string, value: unknown) {
  return value === undefined || isQueryLiteralMap(value)
    ? undefined
    : {
        code: "json.invalid",
        message: `${label} must be a JSON object keyed by non-empty parameter names.`,
      };
}

function readStoredQueryLiteral(value: unknown, path: string): QueryLiteral {
  if (!isQueryLiteral(value)) {
    throw new SavedQueryDefinitionError(
      "invalid-query-literal",
      `${path} must be a supported query literal.`,
    );
  }
  return value;
}

function readStoredQueryLiteralMap(
  value: unknown,
  path: string,
): Readonly<Record<string, QueryLiteral>> {
  if (!isQueryLiteralMap(value)) {
    throw new SavedQueryDefinitionError(
      "invalid-query-params",
      `${path} must be a JSON object keyed by non-empty parameter names.`,
    );
  }
  return value;
}

function readStoredSerializedQueryRequest(value: unknown, path: string): SerializedQueryRequest {
  try {
    return validateSerializedQueryRequest(value);
  } catch (error) {
    throw new SavedQueryDefinitionError("invalid-query", `${path} ${(error as Error).message}`);
  }
}

function readStoredRendererDefinition(value: unknown, path: string): SavedViewRendererDefinition {
  if (!isPlainObject(value)) {
    throw new SavedQueryDefinitionError(
      "invalid-renderer-definition",
      `${path} must be a plain JSON object.`,
    );
  }
  return value as SavedViewRendererDefinition;
}

function validateOptionalJsonObject(label: string, value: unknown) {
  return value === undefined || isPlainObject(value)
    ? undefined
    : {
        code: "json.invalid",
        message: `${label} must be a plain JSON object.`,
      };
}

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compareByOrderAndName(
  left: { id: string; name: string; order: number },
  right: { id: string; name: string; order: number },
): number {
  if (left.order !== right.order) return left.order - right.order;
  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) return byName;
  return left.id.localeCompare(right.id);
}

function normalizeSavedQueryRequest(request: SerializedQueryRequest): SerializedQueryRequest {
  switch (request.query.kind) {
    case "collection": {
      const window = request.query.window;
      return {
        ...request,
        query: {
          ...request.query,
          ...(window
            ? {
                window: {
                  limit: window.limit,
                },
              }
            : {}),
        },
      };
    }
    case "scope": {
      const window = request.query.window;
      return {
        ...request,
        query: {
          ...request.query,
          ...(window
            ? {
                window: {
                  limit: window.limit,
                },
              }
            : {}),
        },
      };
    }
    default:
      return request;
  }
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalizeValue(value[key])]),
  );
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

async function hashSavedQueryDefinition(input: {
  readonly parameterDefinitions: readonly QueryParameterDefinition[];
  readonly request: SerializedQueryRequest;
  readonly surface?: SavedQuerySurfaceBinding;
}): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      canonicalStringify({
        parameterDefinitions: input.parameterDefinitions,
        request: input.request,
        ...(input.surface ? { surface: input.surface } : {}),
      }),
    ),
  );
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function requireSavedQuerySurface(
  request: SerializedQueryRequest,
  surface: SavedQuerySurfaceBinding | undefined,
): void {
  if (request.query.kind !== "collection" && request.query.kind !== "scope") {
    return;
  }
  if (!surface) {
    throw new SavedQueryDefinitionError(
      "missing-surface",
      `Saved ${request.query.kind} queries must bind a module-owned query surface.`,
    );
  }
  if (
    !surface.moduleId.trim() ||
    !surface.catalogId.trim() ||
    !surface.catalogVersion.trim() ||
    !surface.surfaceId.trim() ||
    !surface.surfaceVersion.trim()
  ) {
    throw new SavedQueryDefinitionError(
      "invalid-surface",
      "Saved query surface bindings must provide module, catalog, and surface ids plus versions.",
    );
  }
  if (request.query.kind === "collection" && request.query.indexId !== surface.surfaceId) {
    throw new SavedQueryDefinitionError(
      "surface-mismatch",
      `Saved query surface "${surface.surfaceId}" does not match collection source "${request.query.indexId}".`,
    );
  }
  if (request.query.kind === "scope" && request.query.scopeId !== surface.surfaceId) {
    throw new SavedQueryDefinitionError(
      "surface-mismatch",
      `Saved query surface "${surface.surfaceId}" does not match scope source "${request.query.scopeId ?? "inline"}".`,
    );
  }
}

async function prepareSavedQueryWrite(input: SavedQueryDefinitionInput): Promise<{
  readonly definitionHash: string;
  readonly ownerId: string;
  readonly parameterDefinitions: readonly QueryParameterDefinition[];
  readonly request: SerializedQueryRequest;
  readonly surface?: SavedQuerySurfaceBinding;
}> {
  if (input.ownerId.trim().length === 0) {
    throw new SavedQueryDefinitionError(
      "invalid-owner-id",
      "Saved queries must reference a non-empty owner id.",
    );
  }
  const parameterDefinitions = [...(input.parameterDefinitions ?? [])];
  const request = normalizeSavedQueryRequest(input.request);
  validateSerializedQueryRequest(request, {
    parameterDefinitions,
  });
  requireSavedQuerySurface(request, input.surface);
  const definitionHash = await hashSavedQueryDefinition({
    parameterDefinitions,
    request,
    surface: input.surface,
  });
  return {
    definitionHash,
    ownerId: input.ownerId.trim(),
    parameterDefinitions,
    request,
    ...(input.surface ? { surface: input.surface } : {}),
  };
}

function requireSavedViewInput(input: SavedViewDefinitionInput): void {
  if (input.ownerId.trim().length === 0) {
    throw new SavedQueryDefinitionError(
      "invalid-owner-id",
      "Saved views must reference a non-empty owner id.",
    );
  }
  if (input.containerId.trim().length === 0) {
    throw new SavedQueryDefinitionError(
      "invalid-container-id",
      "Saved views must reference a stable container id.",
    );
  }
  if (input.queryId.trim().length === 0) {
    throw new SavedQueryDefinitionError("invalid-query-id", "Saved views must reference a query.");
  }
  if (input.rendererId.trim().length === 0) {
    throw new SavedQueryDefinitionError(
      "invalid-renderer-id",
      "Saved views must reference a stable renderer id.",
    );
  }
  if (input.queryParams && !isQueryLiteralMap(input.queryParams)) {
    throw new SavedQueryDefinitionError(
      "invalid-query-params",
      "Saved view parameter defaults must be a JSON object keyed by non-empty parameter names.",
    );
  }
  if (input.containerDefaults?.pagination) {
    const { mode, pageSize } = input.containerDefaults.pagination;
    if (!savedViewPaginationModeValues.includes(mode)) {
      throw new SavedQueryDefinitionError(
        "invalid-pagination-mode",
        `Saved view pagination mode must be one of: ${savedViewPaginationModeValues.join(", ")}.`,
      );
    }
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      throw new SavedQueryDefinitionError(
        "invalid-page-size",
        "Saved view page size must be a positive integer.",
      );
    }
  }
  if (input.containerDefaults?.refresh) {
    const { mode, pollIntervalMs } = input.containerDefaults.refresh;
    if (!savedViewRefreshModeValues.includes(mode)) {
      throw new SavedQueryDefinitionError(
        "invalid-refresh-mode",
        `Saved view refresh mode must be one of: ${savedViewRefreshModeValues.join(", ")}.`,
      );
    }
    if (mode === "poll") {
      if (!Number.isInteger(pollIntervalMs) || (pollIntervalMs ?? 0) <= 0) {
        throw new SavedQueryDefinitionError(
          "invalid-poll-interval",
          "Saved poll-backed views must define a positive poll interval.",
        );
      }
    } else if (pollIntervalMs !== undefined) {
      throw new SavedQueryDefinitionError(
        "unexpected-poll-interval",
        "Only poll-backed saved views may define a poll interval.",
      );
    }
  }
  if (input.rendererDefinition && !isPlainObject(input.rendererDefinition)) {
    throw new SavedQueryDefinitionError(
      "invalid-renderer-definition",
      "Saved view renderer definitions must be plain JSON objects.",
    );
  }
}

function requiredStringField(label: string, description?: string) {
  return stringTypeModule.field({
    cardinality: "one",
    validate: ({ value }) => validateRequiredString(label, value),
    meta: {
      label,
      ...(description ? { description } : {}),
    },
    filter: {
      operators: ["equals", "prefix"] as const,
      defaultOperator: "equals",
    },
  });
}

const savedQueryDefsDescription =
  "Reusable parameter definitions for this saved query live on core:savedQueryParameter records.";

const savedQuerySurfaceDescription =
  "Module-owned query surface compatibility boundary for this saved query.";

export const savedQuery = defineType({
  values: { key: "core:savedQuery", name: "Saved Query" },
  fields: {
    ...node.fields,
    ownerId: requiredStringField("Owner id"),
    queryKind: stringTypeModule.field({
      cardinality: "one",
      validate: ({ value }) => validateAllowedValue("Query kind", value, savedQueryKindValues),
      meta: {
        label: "Query kind",
        description: "Canonical serialized-query family for this durable saved query.",
      },
      filter: {
        operators: ["equals"] as const,
        defaultOperator: "equals",
      },
    }),
    definitionHash: requiredStringField(
      "Definition hash",
      "Stable identity hash derived from the normalized serialized query plus declared parameters.",
    ),
    request: jsonTypeModule.field({
      cardinality: "one",
      validate: ({ value }) => {
        try {
          validateSerializedQueryRequest(value);
          return undefined;
        } catch (error) {
          return {
            code: "saved-query.invalid",
            message: (error as Error).message,
          };
        }
      },
      meta: {
        label: "Request",
        description: savedQueryDefsDescription,
      },
    }),
    surface: {
      moduleId: requiredStringField("Module id", savedQuerySurfaceDescription),
      catalogId: requiredStringField("Catalog id", savedQuerySurfaceDescription),
      catalogVersion: requiredStringField("Catalog version", savedQuerySurfaceDescription),
      surfaceId: requiredStringField("Surface id", savedQuerySurfaceDescription),
      surfaceVersion: requiredStringField("Surface version", savedQuerySurfaceDescription),
    },
  },
});

export const savedQueryParameter = defineType({
  values: { key: "core:savedQueryParameter", name: "Saved Query Parameter" },
  fields: {
    ...node.fields,
    query: existingEntityReferenceField(savedQuery, {
      cardinality: "one",
      label: "Saved query",
    }),
    order: numberTypeModule.field({
      cardinality: "one",
      validate: ({ value }) => validatePositiveInteger("Order", value),
      meta: {
        label: "Order",
      },
    }),
    name: requiredStringField("Name"),
    label: requiredStringField("Label"),
    type: stringTypeModule.field({
      cardinality: "one",
      validate: ({ value }) =>
        validateAllowedValue("Parameter type", value, queryParameterTypeValues),
      meta: {
        label: "Type",
      },
      filter: {
        operators: ["equals"] as const,
        defaultOperator: "equals",
      },
    }),
    required: {
      ...booleanTypeModule.field({
        cardinality: "one",
        onCreate: ({ incoming }) => incoming ?? false,
        meta: {
          label: "Required",
        },
      }),
      createOptional: true as const,
    },
    defaultValue: jsonTypeModule.field({
      cardinality: "one?",
      validate: ({ value }) =>
        value === undefined || isQueryLiteral(value)
          ? undefined
          : {
              code: "json.invalid",
              message: "Default value must be a supported query literal.",
            },
      meta: {
        label: "Default value",
      },
    }),
  },
});

export const savedView = defineType({
  values: { key: "core:savedView", name: "Saved View" },
  fields: {
    ...node.fields,
    ownerId: requiredStringField("Owner id"),
    query: existingEntityReferenceField(savedQuery, {
      cardinality: "one",
      label: "Saved query",
    }),
    containerId: requiredStringField("Container id"),
    rendererId: requiredStringField("Renderer id"),
    rendererDefinition: jsonTypeModule.field({
      cardinality: "one?",
      validate: ({ value }) => validateOptionalJsonObject("Renderer definition", value),
      meta: {
        label: "Renderer definition",
      },
    }),
    queryParams: jsonTypeModule.field({
      cardinality: "one?",
      validate: ({ value }) => validateQueryLiteralMap("Query params", value),
      meta: {
        label: "Query params",
      },
    }),
    containerDefaults: {
      pagination: {
        mode: stringTypeModule.field({
          cardinality: "one",
          validate: ({ value }) =>
            validateAllowedValue("Pagination mode", value, savedViewPaginationModeValues),
          meta: {
            label: "Pagination mode",
          },
        }),
        pageSize: numberTypeModule.field({
          cardinality: "one",
          validate: ({ value }) => validatePositiveInteger("Page size", value),
          meta: {
            label: "Page size",
          },
        }),
      },
      refresh: {
        mode: stringTypeModule.field({
          cardinality: "one",
          validate: ({ value }) =>
            validateAllowedValue("Refresh mode", value, savedViewRefreshModeValues),
          meta: {
            label: "Refresh mode",
          },
        }),
        pollIntervalMs: numberTypeModule.field({
          cardinality: "one?",
          validate: ({ value }) =>
            value === undefined ? undefined : validatePositiveInteger("Poll interval", value),
          meta: {
            label: "Poll interval",
          },
        }),
      },
    },
  },
});

type SavedQueryEntityInput = {
  readonly createdAt?: Date;
  readonly definitionHash: string;
  readonly description?: string;
  readonly name: string;
  readonly ownerId: string;
  readonly queryKind: string;
  readonly request: unknown;
  readonly surface?: SavedQuerySurfaceBinding;
  readonly updatedAt?: Date;
};

type SavedQueryEntity = Omit<SavedQueryEntityInput, "createdAt" | "surface" | "updatedAt"> & {
  readonly createdAt: Date;
  readonly id: string;
  readonly surface: {
    readonly catalogId?: string;
    readonly catalogVersion?: string;
    readonly moduleId?: string;
    readonly surfaceId?: string;
    readonly surfaceVersion?: string;
  };
  readonly updatedAt: Date;
};

type SavedQueryParameterEntityInput = {
  readonly createdAt?: Date;
  readonly defaultValue?: unknown;
  readonly description?: string;
  readonly label: string;
  readonly name: string;
  readonly order: number;
  readonly query: string;
  readonly required?: boolean;
  readonly type: string;
  readonly updatedAt?: Date;
};

type SavedQueryParameterEntity = SavedQueryParameterEntityInput & {
  readonly id: string;
};

type SavedViewEntityInput = {
  readonly containerId: string;
  readonly containerDefaults?: {
    readonly pagination?: {
      readonly mode: string;
      readonly pageSize: number;
    };
    readonly refresh?: {
      readonly mode: string;
      readonly pollIntervalMs?: number;
    };
  };
  readonly createdAt?: Date;
  readonly description?: string;
  readonly name: string;
  readonly ownerId: string;
  readonly query: string;
  readonly queryParams?: unknown;
  readonly rendererDefinition?: unknown;
  readonly rendererId: string;
  readonly updatedAt?: Date;
};

type SavedViewEntity = Omit<
  SavedViewEntityInput,
  "containerDefaults" | "createdAt" | "updatedAt"
> & {
  readonly containerDefaults: {
    readonly pagination: {
      readonly mode?: string;
      readonly pageSize?: number;
    };
    readonly refresh: {
      readonly mode?: string;
      readonly pollIntervalMs?: number;
    };
  };
  readonly createdAt: Date;
  readonly id: string;
  readonly updatedAt: Date;
};

type EntityHandle<Input, Entity> = {
  create(input: Input): string;
  delete(id: string): void;
  get(id: string): Entity;
  list(): readonly Entity[];
  update(id: string, patch: Partial<Input>): Entity;
};

export type SavedQueryGraphClient = {
  readonly savedQuery: EntityHandle<SavedQueryEntityInput, SavedQueryEntity>;
  readonly savedQueryParameter: EntityHandle<
    SavedQueryParameterEntityInput,
    SavedQueryParameterEntity
  >;
  readonly savedView: EntityHandle<SavedViewEntityInput, SavedViewEntity>;
};

function toSavedQueryEntityInput(input: {
  readonly definitionHash: string;
  readonly description?: string;
  readonly name: string;
  readonly ownerId: string;
  readonly request: SerializedQueryRequest;
  readonly surface?: SavedQuerySurfaceBinding;
}): SavedQueryEntityInput {
  return {
    definitionHash: input.definitionHash,
    ...(input.description ? { description: input.description } : {}),
    name: input.name,
    ownerId: input.ownerId,
    queryKind: input.request.query.kind,
    request: input.request,
    ...(input.surface ? { surface: input.surface } : {}),
  };
}

function toSavedQueryParameterEntityInput(
  queryId: string,
  definition: QueryParameterDefinition,
  order: number,
): SavedQueryParameterEntityInput {
  return {
    label: definition.label,
    name: definition.name,
    order,
    query: queryId,
    ...(definition.defaultValue === undefined ? {} : { defaultValue: definition.defaultValue }),
    ...(definition.required ? { required: true } : {}),
    type: definition.type,
  };
}

function toSavedViewEntityInput(input: SavedViewDefinitionInput): SavedViewEntityInput {
  return {
    containerId: input.containerId,
    ...(input.containerDefaults
      ? {
          containerDefaults: {
            ...(input.containerDefaults.pagination
              ? {
                  pagination: {
                    mode: input.containerDefaults.pagination.mode,
                    pageSize: input.containerDefaults.pagination.pageSize,
                  },
                }
              : {}),
            ...(input.containerDefaults.refresh
              ? {
                  refresh: {
                    mode: input.containerDefaults.refresh.mode,
                    ...(input.containerDefaults.refresh.pollIntervalMs === undefined
                      ? {}
                      : { pollIntervalMs: input.containerDefaults.refresh.pollIntervalMs }),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(input.description ? { description: input.description } : {}),
    name: input.name,
    ownerId: input.ownerId,
    query: input.queryId,
    ...(input.queryParams ? { queryParams: input.queryParams } : {}),
    ...(input.rendererDefinition ? { rendererDefinition: input.rendererDefinition } : {}),
    rendererId: input.rendererId,
  };
}

function listSavedQueryParameterEntities(
  graph: SavedQueryGraphClient,
  queryId: string,
): readonly SavedQueryParameterEntity[] {
  return graph.savedQueryParameter
    .list()
    .filter((parameter) => parameter.query === queryId)
    .slice()
    .sort((left, right) =>
      compareByOrderAndName(
        { id: left.id, name: left.name, order: left.order },
        { id: right.id, name: right.name, order: right.order },
      ),
    );
}

function readOptionalSurface(
  surface: SavedQueryEntity["surface"],
): SavedQuerySurfaceBinding | undefined {
  const moduleId = trimOptionalString(surface.moduleId);
  const catalogId = trimOptionalString(surface.catalogId);
  const catalogVersion = trimOptionalString(surface.catalogVersion);
  const surfaceId = trimOptionalString(surface.surfaceId);
  const surfaceVersion = trimOptionalString(surface.surfaceVersion);
  if (!moduleId && !catalogId && !catalogVersion && !surfaceId && !surfaceVersion) {
    return undefined;
  }
  if (!moduleId || !catalogId || !catalogVersion || !surfaceId || !surfaceVersion) {
    throw new SavedQueryDefinitionError(
      "invalid-surface",
      "Saved query surface bindings must be either fully populated or omitted.",
    );
  }
  return {
    moduleId,
    catalogId,
    catalogVersion,
    surfaceId,
    surfaceVersion,
  };
}

async function materializeSavedQueryDefinition(
  entity: SavedQueryEntity,
  parameterEntities: readonly SavedQueryParameterEntity[],
): Promise<SavedQueryDefinition> {
  const parameterDefinitions = parameterEntities.map((parameter) => ({
    ...(parameter.defaultValue === undefined
      ? {}
      : {
          defaultValue: readStoredQueryLiteral(
            parameter.defaultValue,
            `${parameter.id}.defaultValue`,
          ),
        }),
    label: parameter.label,
    name: parameter.name,
    ...(parameter.required ? { required: true } : {}),
    type: parameter.type as QueryParameterType,
  }));
  const request = normalizeSavedQueryRequest(
    readStoredSerializedQueryRequest(entity.request, `${entity.id}.request`),
  );
  validateSerializedQueryRequest(request, {
    parameterDefinitions,
  });
  const surface = readOptionalSurface(entity.surface);
  requireSavedQuerySurface(request, surface);
  if (entity.queryKind !== request.query.kind) {
    throw new SavedQueryDefinitionError(
      "kind-mismatch",
      `Saved query "${entity.id}" stores kind "${entity.queryKind}" but serializes "${request.query.kind}".`,
    );
  }
  const definitionHash = await hashSavedQueryDefinition({
    parameterDefinitions,
    request,
    ...(surface ? { surface } : {}),
  });
  if (definitionHash !== entity.definitionHash) {
    throw new SavedQueryDefinitionError(
      "hash-mismatch",
      `Saved query "${entity.id}" has stale durable identity "${entity.definitionHash}".`,
    );
  }
  return {
    createdAt: entity.createdAt,
    definitionHash: entity.definitionHash,
    ...(entity.description ? { description: entity.description } : {}),
    id: entity.id,
    kind: entity.queryKind as SavedQueryKind,
    name: entity.name,
    ownerId: entity.ownerId,
    parameterDefinitions,
    request,
    ...(surface ? { surface } : {}),
    updatedAt: entity.updatedAt,
  };
}

function materializeSavedViewDefinition(entity: SavedViewEntity): SavedViewDefinition {
  const pagination = entity.containerDefaults.pagination;
  const refresh = entity.containerDefaults.refresh;
  const hasPaginationMode = pagination.mode !== undefined;
  const hasPageSize = pagination.pageSize !== undefined;
  if (hasPaginationMode !== hasPageSize) {
    throw new SavedQueryDefinitionError(
      "invalid-pagination-defaults",
      `Saved view "${entity.id}" stores partial pagination defaults.`,
    );
  }
  const paginationDefaults =
    pagination.mode && pagination.pageSize
      ? {
          mode: pagination.mode as SavedViewPaginationMode,
          pageSize: pagination.pageSize,
        }
      : undefined;
  const refreshDefaults = refresh.mode
    ? {
        mode: refresh.mode as SavedViewRefreshMode,
        ...(refresh.pollIntervalMs === undefined ? {} : { pollIntervalMs: refresh.pollIntervalMs }),
      }
    : undefined;
  const queryParams =
    entity.queryParams === undefined
      ? undefined
      : readStoredQueryLiteralMap(entity.queryParams, `${entity.id}.queryParams`);
  const rendererDefinition =
    entity.rendererDefinition === undefined
      ? undefined
      : readStoredRendererDefinition(entity.rendererDefinition, `${entity.id}.rendererDefinition`);
  const materialized: SavedViewDefinition = {
    containerId: entity.containerId,
    ...(paginationDefaults || refreshDefaults
      ? {
          containerDefaults: {
            ...(paginationDefaults ? { pagination: paginationDefaults } : {}),
            ...(refreshDefaults ? { refresh: refreshDefaults } : {}),
          },
        }
      : {}),
    createdAt: entity.createdAt,
    ...(entity.description ? { description: entity.description } : {}),
    id: entity.id,
    name: entity.name,
    ownerId: entity.ownerId,
    queryId: entity.query,
    ...(queryParams ? { queryParams } : {}),
    ...(rendererDefinition ? { rendererDefinition } : {}),
    rendererId: entity.rendererId,
    updatedAt: entity.updatedAt,
  };
  requireSavedViewInput(materialized);
  return materialized;
}

function replaceSavedQueryParameterEntities(
  graph: SavedQueryGraphClient,
  queryId: string,
  parameterDefinitions: readonly QueryParameterDefinition[],
): void {
  for (const parameter of listSavedQueryParameterEntities(graph, queryId)) {
    graph.savedQueryParameter.delete(parameter.id);
  }
  parameterDefinitions.forEach((definition, index) => {
    graph.savedQueryParameter.create(
      toSavedQueryParameterEntityInput(queryId, definition, index + 1),
    );
  });
}

export async function createSavedQueryDefinition(
  graph: SavedQueryGraphClient,
  input: SavedQueryDefinitionInput,
): Promise<SavedQueryDefinition> {
  const prepared = await prepareSavedQueryWrite(input);
  const queryId = graph.savedQuery.create(
    toSavedQueryEntityInput({
      definitionHash: prepared.definitionHash,
      description: trimOptionalString(input.description),
      name: input.name.trim(),
      ownerId: prepared.ownerId,
      request: prepared.request,
      surface: prepared.surface,
    }),
  );
  replaceSavedQueryParameterEntities(graph, queryId, prepared.parameterDefinitions);
  return readSavedQueryDefinition(graph, queryId);
}

export async function updateSavedQueryDefinition(
  graph: SavedQueryGraphClient,
  queryId: string,
  input: SavedQueryDefinitionInput,
): Promise<SavedQueryDefinition> {
  const prepared = await prepareSavedQueryWrite(input);
  graph.savedQuery.update(
    queryId,
    toSavedQueryEntityInput({
      definitionHash: prepared.definitionHash,
      description: trimOptionalString(input.description),
      name: input.name.trim(),
      ownerId: prepared.ownerId,
      request: prepared.request,
      surface: prepared.surface,
    }),
  );
  replaceSavedQueryParameterEntities(graph, queryId, prepared.parameterDefinitions);
  return readSavedQueryDefinition(graph, queryId);
}

export async function readSavedQueryDefinition(
  graph: SavedQueryGraphClient,
  queryId: string,
): Promise<SavedQueryDefinition> {
  const entity = graph.savedQuery.get(queryId);
  return materializeSavedQueryDefinition(entity, listSavedQueryParameterEntities(graph, queryId));
}

export function listSavedQueryParameterDefinitions(
  graph: SavedQueryGraphClient,
  queryId: string,
): readonly QueryParameterDefinition[] {
  return listSavedQueryParameterEntities(graph, queryId).map((parameter) => ({
    ...(parameter.defaultValue === undefined
      ? {}
      : {
          defaultValue: readStoredQueryLiteral(
            parameter.defaultValue,
            `${parameter.id}.defaultValue`,
          ),
        }),
    label: parameter.label,
    name: parameter.name,
    ...(parameter.required ? { required: true } : {}),
    type: parameter.type as QueryParameterType,
  }));
}

export function listSavedViewsForQuery(
  graph: SavedQueryGraphClient,
  queryId: string,
): readonly SavedViewDefinition[] {
  return graph.savedView
    .list()
    .filter((view) => view.query === queryId)
    .map(materializeSavedViewDefinition)
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function createSavedViewDefinition(
  graph: SavedQueryGraphClient,
  input: SavedViewDefinitionInput,
): SavedViewDefinition {
  requireSavedViewInput(input);
  const viewId = graph.savedView.create(
    toSavedViewEntityInput({
      ...input,
      containerId: input.containerId.trim(),
      description: trimOptionalString(input.description),
      name: input.name.trim(),
      ownerId: input.ownerId.trim(),
      queryId: input.queryId.trim(),
      rendererId: input.rendererId.trim(),
    }),
  );
  return readSavedViewDefinition(graph, viewId);
}

export function updateSavedViewDefinition(
  graph: SavedQueryGraphClient,
  viewId: string,
  input: SavedViewDefinitionInput,
): SavedViewDefinition {
  requireSavedViewInput(input);
  graph.savedView.update(
    viewId,
    toSavedViewEntityInput({
      ...input,
      containerId: input.containerId.trim(),
      description: trimOptionalString(input.description),
      name: input.name.trim(),
      ownerId: input.ownerId.trim(),
      queryId: input.queryId.trim(),
      rendererId: input.rendererId.trim(),
    }),
  );
  return readSavedViewDefinition(graph, viewId);
}

export function readSavedViewDefinition(
  graph: SavedQueryGraphClient,
  viewId: string,
): SavedViewDefinition {
  return materializeSavedViewDefinition(graph.savedView.get(viewId));
}
