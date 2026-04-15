import type { GraphBootstrapOptions } from "@dpeek/graphle-bootstrap";

import { core } from "../core.js";
import { resolvePredicateDefinitionIconId, resolveTypeDefinitionIconId } from "../icon/resolve.js";
import { unknownIconSeed } from "../icon/seed.js";

/**
 * Domain-owned bootstrap adapter for the built-in core namespace.
 *
 * The concrete core icon catalog stays with the core module tree and plugs into
 * `@dpeek/graphle-bootstrap` through its public icon contracts.
 */
export const coreGraphBootstrapOptions: GraphBootstrapOptions = Object.freeze({
  availableDefinitions: core,
  cacheKey: core,
  coreSchema: core,
  iconSeeds: [unknownIconSeed],
  resolvePredicateIconId: resolvePredicateDefinitionIconId,
  resolveTypeIconId: resolveTypeDefinitionIconId,
});
