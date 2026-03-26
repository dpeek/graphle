import type {
  AuthoritativeGraphChangesAfterResult,
  AuthoritativeGraphRetainedHistoryPolicy,
  AuthoritativeGraphWriteHistory,
  AuthoritativeGraphWriteResult,
  GraphStoreSnapshot,
  GraphWriteScope,
  GraphWriteTransaction,
} from "@io/graph-kernel";
import type { IncrementalSyncResult, SyncFreshness } from "@io/graph-sync";

/**
 * One predicate candidate considered for authority-side replication output.
 */
export type ReplicatedPredicateTarget = {
  readonly subjectId: string;
  readonly predicateId: string;
};

/**
 * Optional authority-owned read filter applied after transport-visibility
 * filtering.
 *
 * Returning `false` omits that predicate from total or incremental replication
 * output without mutating the stored authority snapshot or history.
 */
export type ReplicationReadAuthorizer = (target: ReplicatedPredicateTarget) => boolean;

/**
 * In-memory authoritative write runtime over one graph store.
 *
 * Transaction ids are treated as authority idempotency keys. Reapplying the
 * same canonical transaction returns the previously accepted result with
 * `replayed: true`; reusing an id for different contents fails validation.
 *
 * The retained-history policy advances the base cursor whenever older accepted
 * writes are pruned. Callers holding a cursor older than that base must fall
 * back to total sync.
 */
export interface AuthoritativeGraphWriteSession {
  /**
   * Validates and applies one authoritative write against the backing store.
   */
  apply(
    transaction: GraphWriteTransaction,
    options?: {
      writeScope?: GraphWriteScope;
    },
  ): AuthoritativeGraphWriteResult;
  /**
   * Validates and applies one authoritative write while also returning the
   * post-apply snapshot used for durable commit boundaries.
   */
  applyWithSnapshot(
    transaction: GraphWriteTransaction,
    options?: {
      writeScope?: GraphWriteScope;
      sourceSnapshot?: GraphStoreSnapshot;
    },
  ): {
    result: AuthoritativeGraphWriteResult;
    snapshot: GraphStoreSnapshot;
  };
  /**
   * Returns the current head cursor, or `undefined` before any accepted write.
   */
  getCursor(): string | undefined;
  /**
   * Returns the retained-history base cursor.
   *
   * Incremental callers older than this cursor have fallen out of the retained
   * replay window and must recover with total sync.
   */
  getBaseCursor(): string;
  getRetainedHistoryPolicy(): AuthoritativeGraphRetainedHistoryPolicy;
  getChangesAfter(cursor?: string): AuthoritativeGraphChangesAfterResult;
  /**
   * Produces incremental sync output after transport visibility filtering and
   * the optional authority-owned read authorizer.
   */
  getIncrementalSyncResult(
    after?: string,
    options?: {
      authorizeRead?: ReplicationReadAuthorizer;
      freshness?: SyncFreshness;
    },
  ): IncrementalSyncResult;
  /**
   * Returns the retained write history currently backing the session.
   */
  getHistory(): AuthoritativeGraphWriteHistory;
}
