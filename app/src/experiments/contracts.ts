import type { AnyTypeOutput, NamespaceClient } from "@io/graph";
import type { ComponentType } from "react";

export type AppRouteGroupKey = "proofs" | "tools" | "settings";

export type AppExperimentMeta<TKey extends string = string> = {
  readonly key: TKey;
  readonly label: string;
  readonly description: string;
};

export type AppExperimentRouteDefinition<TKey extends string = string> = {
  readonly component: ComponentType;
  readonly description: string;
  readonly group: AppRouteGroupKey;
  readonly key: TKey;
  readonly label: string;
  readonly path: string;
  readonly shellClassName: string;
  readonly title: string;
};

export type AppExperimentSchema = Record<string, AnyTypeOutput>;
export type AppExperimentSeedResult = Record<string, unknown>;

export type AppExperimentGraphDefinition<
  TKey extends string = string,
  TSchema extends AppExperimentSchema = {},
  TSeedResult extends AppExperimentSeedResult | void = void,
> = AppExperimentMeta<TKey> & {
  readonly schema?: TSchema;
  readonly seed?: (graph: NamespaceClient<any>) => TSeedResult;
};

export type AppExperimentWebDefinition<
  TKey extends string = string,
  TRoute extends AppExperimentRouteDefinition = AppExperimentRouteDefinition,
> = AppExperimentMeta<TKey> & {
  readonly routes: readonly TRoute[];
};

export const appRouteGroups = [
  {
    key: "proofs",
    label: "Proofs",
  },
  {
    key: "tools",
    label: "Tools",
  },
  {
    key: "settings",
    label: "Settings",
  },
] as const satisfies readonly {
  readonly key: AppRouteGroupKey;
  readonly label: string;
}[];

export function defineAppExperimentGraph<const T extends AppExperimentGraphDefinition>(
  definition: T,
): T {
  return definition;
}

export function defineAppExperimentWeb<const T extends AppExperimentWebDefinition>(
  definition: T,
): T {
  return definition;
}

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

type RegisteredSchemaOf<TDefinition> = TDefinition extends {
  schema: infer TSchema extends AppExperimentSchema;
}
  ? TSchema
  : {};

type RegisteredSeedResultOf<TDefinition> = TDefinition extends {
  seed: (...args: any[]) => infer TResult;
}
  ? TResult extends void
    ? {}
    : TResult
  : {};

type RegisteredRouteOf<TDefinition> = TDefinition extends {
  routes: readonly (infer TRoute)[];
}
  ? TRoute
  : never;

export type RegisteredExperimentSchema<
  TDefinitions extends readonly AppExperimentGraphDefinition[],
> = UnionToIntersection<RegisteredSchemaOf<TDefinitions[number]>>;

export type RegisteredExperimentSeedResult<
  TDefinitions extends readonly AppExperimentGraphDefinition[],
> = UnionToIntersection<RegisteredSeedResultOf<TDefinitions[number]>>;

export type RegisteredExperimentRoute<TDefinitions extends readonly AppExperimentWebDefinition[]> =
  RegisteredRouteOf<TDefinitions[number]>;

export function collectExperimentSchema<
  const TDefinitions extends readonly AppExperimentGraphDefinition[],
>(definitions: TDefinitions): RegisteredExperimentSchema<TDefinitions> {
  return Object.assign(
    {},
    ...definitions.map((definition) => definition.schema ?? {}),
  ) as RegisteredExperimentSchema<TDefinitions>;
}

export function seedRegisteredExperiments<
  const TDefinitions extends readonly AppExperimentGraphDefinition[],
>(
  definitions: TDefinitions,
  graph: NamespaceClient<any>,
): RegisteredExperimentSeedResult<TDefinitions> {
  return Object.assign(
    {},
    ...definitions.map((definition) => definition.seed?.(graph) ?? {}),
  ) as RegisteredExperimentSeedResult<TDefinitions>;
}

export function collectExperimentRoutes<
  const TDefinitions extends readonly AppExperimentWebDefinition[],
>(definitions: TDefinitions): readonly RegisteredExperimentRoute<TDefinitions>[] {
  return definitions.flatMap(
    (definition) => definition.routes,
  ) as unknown as readonly RegisteredExperimentRoute<TDefinitions>[];
}
