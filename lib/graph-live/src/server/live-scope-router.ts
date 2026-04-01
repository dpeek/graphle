import { isInvalidationEventCompatibleWithTarget, type DependencyKey } from "@io/graph-projection";

import type {
  LiveScopeInvalidation,
  LiveScopePullResult,
  LiveScopeRegistration,
  LiveScopeRegistrationTarget,
} from "../live-scope.js";

const defaultLiveScopeRegistrationTtlMs = 60_000;

export type LiveScopeRouterOptions = {
  readonly now?: () => Date;
  readonly registrationTtlMs?: number;
};

export type LiveScopeRouter = {
  register(input: LiveScopeRegistrationTarget): LiveScopeRegistration;
  publish(invalidation: LiveScopeInvalidation): readonly LiveScopeRegistration[];
  pull(input: { readonly scopeId: string; readonly sessionId: string }): LiveScopePullResult;
  remove(input: { readonly scopeId: string; readonly sessionId: string }): boolean;
  expire(): readonly LiveScopeRegistration[];
  registrationsForDependencyKey(dependencyKey: DependencyKey): readonly LiveScopeRegistration[];
  registrationsForScope(scopeId: string): readonly LiveScopeRegistration[];
  registrationsForSession(sessionId: string): readonly LiveScopeRegistration[];
};

function createRegistrationId(sessionId: string, scopeId: string): string {
  return `live-scope:${sessionId}:${scopeId}`;
}

function createSessionScopeKey(sessionId: string, scopeId: string): string {
  return `${sessionId}\u0000${scopeId}`;
}

function createFrozenRegistration(
  registrationId: string,
  input: LiveScopeRegistrationTarget,
  expiresAt: string,
): LiveScopeRegistration {
  return Object.freeze({
    ...input,
    registrationId,
    dependencyKeys: Object.freeze([...input.dependencyKeys]),
    expiresAt,
  });
}

function sortRegistrations(
  registrations: Iterable<LiveScopeRegistration>,
): readonly LiveScopeRegistration[] {
  return [...registrations].sort((left, right) =>
    left.registrationId.localeCompare(right.registrationId),
  );
}

function addIndexedRegistration(
  index: Map<string, Set<string>>,
  key: string,
  registrationId: string,
): void {
  const existing = index.get(key);
  if (existing) {
    existing.add(registrationId);
    return;
  }

  index.set(key, new Set([registrationId]));
}

function removeIndexedRegistration(
  index: Map<string, Set<string>>,
  key: string,
  registrationId: string,
): void {
  const registrations = index.get(key);
  if (!registrations) return;

  registrations.delete(registrationId);
  if (registrations.size === 0) {
    index.delete(key);
  }
}

export function createLiveScopeRouter(options: LiveScopeRouterOptions = {}): LiveScopeRouter {
  const now = options.now ?? (() => new Date());
  const registrationTtlMs = options.registrationTtlMs ?? defaultLiveScopeRegistrationTtlMs;

  if (!Number.isInteger(registrationTtlMs) || registrationTtlMs < 1) {
    throw new Error("Live scope registration TTL must be a positive integer.");
  }

  const registrationsById = new Map<string, LiveScopeRegistration>();
  const registrationIdBySessionScope = new Map<string, string>();
  const registrationIdsByDependencyKey = new Map<string, Set<string>>();
  const registrationIdsByScope = new Map<string, Set<string>>();
  const registrationIdsBySession = new Map<string, Set<string>>();
  const invalidationsBySessionScope = new Map<string, readonly LiveScopeInvalidation[]>();

  function unregisterById(registrationId: string): LiveScopeRegistration | undefined {
    const registration = registrationsById.get(registrationId);
    if (!registration) {
      return undefined;
    }

    registrationsById.delete(registrationId);
    const sessionScopeKey = createSessionScopeKey(registration.sessionId, registration.scopeId);
    registrationIdBySessionScope.delete(sessionScopeKey);
    invalidationsBySessionScope.delete(sessionScopeKey);
    removeIndexedRegistration(registrationIdsBySession, registration.sessionId, registrationId);
    removeIndexedRegistration(registrationIdsByScope, registration.scopeId, registrationId);
    for (const dependencyKey of registration.dependencyKeys) {
      removeIndexedRegistration(registrationIdsByDependencyKey, dependencyKey, registrationId);
    }

    return registration;
  }

  function expire(): readonly LiveScopeRegistration[] {
    const expired: LiveScopeRegistration[] = [];
    const nowMs = now().getTime();
    for (const registration of registrationsById.values()) {
      if (Date.parse(registration.expiresAt) > nowMs) {
        continue;
      }

      const removed = unregisterById(registration.registrationId);
      if (removed) {
        expired.push(removed);
      }
    }

    return sortRegistrations(expired);
  }

  function activeRegistrationsForIds(
    registrationIds: readonly string[] | Set<string> | undefined,
  ): readonly LiveScopeRegistration[] {
    expire();
    if (!registrationIds) {
      return [];
    }

    const ids = Array.isArray(registrationIds) ? registrationIds : [...registrationIds];
    if (ids.length === 0) {
      return [];
    }

    return sortRegistrations(
      ids
        .map((registrationId) => registrationsById.get(registrationId))
        .filter(
          (registration): registration is LiveScopeRegistration => registration !== undefined,
        ),
    );
  }

  return {
    register(input) {
      expire();

      const sessionScopeKey = createSessionScopeKey(input.sessionId, input.scopeId);
      const existingRegistrationId = registrationIdBySessionScope.get(sessionScopeKey);
      if (existingRegistrationId) {
        unregisterById(existingRegistrationId);
      }

      const registrationId =
        existingRegistrationId ?? createRegistrationId(input.sessionId, input.scopeId);
      invalidationsBySessionScope.delete(sessionScopeKey);
      const registration = createFrozenRegistration(
        registrationId,
        input,
        new Date(now().getTime() + registrationTtlMs).toISOString(),
      );

      registrationsById.set(registration.registrationId, registration);
      registrationIdBySessionScope.set(sessionScopeKey, registration.registrationId);
      addIndexedRegistration(
        registrationIdsBySession,
        registration.sessionId,
        registration.registrationId,
      );
      addIndexedRegistration(
        registrationIdsByScope,
        registration.scopeId,
        registration.registrationId,
      );
      for (const dependencyKey of registration.dependencyKeys) {
        addIndexedRegistration(
          registrationIdsByDependencyKey,
          dependencyKey,
          registration.registrationId,
        );
      }

      return registration;
    },
    publish(invalidation) {
      expire();

      const candidateRegistrationIds = new Set<string>();
      for (const dependencyKey of invalidation.dependencyKeys) {
        for (const registrationId of registrationIdsByDependencyKey.get(dependencyKey) ?? []) {
          candidateRegistrationIds.add(registrationId);
        }
      }
      for (const scopeId of invalidation.affectedScopeIds ?? []) {
        for (const registrationId of registrationIdsByScope.get(scopeId) ?? []) {
          candidateRegistrationIds.add(registrationId);
        }
      }

      const matchedRegistrations: LiveScopeRegistration[] = [];
      for (const registrationId of candidateRegistrationIds) {
        const registration = registrationsById.get(registrationId);
        if (!registration) {
          continue;
        }
        if (
          !isInvalidationEventCompatibleWithTarget(invalidation, {
            scopeId: registration.scopeId,
            dependencyKeys: registration.dependencyKeys,
          })
        ) {
          continue;
        }

        const sessionScopeKey = createSessionScopeKey(registration.sessionId, registration.scopeId);
        const pending = invalidationsBySessionScope.get(sessionScopeKey) ?? [];
        invalidationsBySessionScope.set(sessionScopeKey, [...pending, invalidation]);
        matchedRegistrations.push(registration);
      }

      return sortRegistrations(matchedRegistrations);
    },
    pull(input) {
      expire();

      const sessionScopeKey = createSessionScopeKey(input.sessionId, input.scopeId);
      const registrationId = registrationIdBySessionScope.get(sessionScopeKey);
      const invalidations = invalidationsBySessionScope.get(sessionScopeKey) ?? [];
      invalidationsBySessionScope.delete(sessionScopeKey);

      return {
        active: registrationId !== undefined && registrationsById.has(registrationId),
        invalidations,
        scopeId: input.scopeId,
        sessionId: input.sessionId,
      };
    },
    remove(input) {
      expire();

      const sessionScopeKey = createSessionScopeKey(input.sessionId, input.scopeId);
      const registrationId = registrationIdBySessionScope.get(sessionScopeKey);
      if (!registrationId) {
        return false;
      }

      return unregisterById(registrationId) !== undefined;
    },
    expire,
    registrationsForDependencyKey(dependencyKey) {
      return activeRegistrationsForIds(registrationIdsByDependencyKey.get(dependencyKey));
    },
    registrationsForScope(scopeId) {
      return activeRegistrationsForIds(registrationIdsByScope.get(scopeId));
    },
    registrationsForSession(sessionId) {
      return activeRegistrationsForIds(registrationIdsBySession.get(sessionId));
    },
  };
}
