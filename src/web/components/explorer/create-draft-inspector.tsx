import { GraphValidationError, typeId } from "@io/core/graph";
import { Button } from "@io/web/button";
import { useEffect, useMemo, useRef, useState } from "react";

import { flattenPredicateRefs } from "./catalog.js";
import { createDraftController } from "./create-draft-controller.js";
import {
  buildCreateDefaults,
  buildCreatePlan,
  getDeferredFieldReason,
  type DraftFieldDefinition,
} from "./create-draft-plan.js";
import { InspectorFieldSection, InspectorShell } from "./inspector.js";
import { explorerNamespace } from "./model.js";
import type { EntityCatalogEntry, ExplorerRuntime } from "./model.js";
import { describeSyncError } from "./sync.js";
import { EmptyState, Section } from "./ui.js";

function DeferredFieldSection({ fields }: { fields: readonly DraftFieldDefinition[] }) {
  if (fields.length === 0) return null;

  return (
    <Section title="After Create">
      <div className="grid gap-3">
        {fields.map((field) => (
          <div
            className="border-border bg-muted/20 rounded-xl border px-4 py-3"
            data-explorer-deferred-field={field.pathLabel}
            key={field.pathLabel}
          >
            <div className="text-sm font-medium">{field.pathLabel}</div>
            <div className="text-muted-foreground mt-1 text-sm">
              {getDeferredFieldReason(field)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function GenericCreateInspector({
  entityEntry,
  entityEntryById,
  onCancelCreate,
  onCreated,
  runtime,
}: {
  entityEntry: EntityCatalogEntry;
  entityEntryById: ReadonlyMap<string, EntityCatalogEntry>;
  onCancelCreate?: () => void;
  onCreated: (entityId: string) => void;
  runtime: ExplorerRuntime;
}) {
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const entityEntryRef = useRef(entityEntry);
  const entityEntryByIdRef = useRef(entityEntryById);

  useEffect(() => {
    entityEntryRef.current = entityEntry;
  }, [entityEntry]);

  useEffect(() => {
    entityEntryByIdRef.current = entityEntryById;
  }, [entityEntryById]);

  const typeById = useMemo(
    () => new Map(Object.values(explorerNamespace).map((typeDef) => [typeId(typeDef), typeDef])),
    [],
  );
  const createPlan = useMemo(() => buildCreatePlan(entityEntry), [entityEntry.id]);
  const controller = useMemo(
    () =>
      createDraftController({
        entry: entityEntry,
        entityEntryByIdRef,
        initialInput: buildCreateDefaults(entityEntry, typeById),
        store: runtime.store,
        typeById,
      }),
    [entityEntry.id, runtime.store, typeById],
  );
  const predicateRows = useMemo(
    () =>
      new Map(flattenPredicateRefs(controller.fields).map((row) => [row.pathLabel, row.predicate])),
    [controller],
  );
  const fieldRows = useMemo(
    () =>
      createPlan.clientFields.flatMap((field) => {
        const predicate = predicateRows.get(field.pathLabel);
        return predicate ? [{ pathLabel: field.pathLabel, predicate }] : [];
      }),
    [createPlan.clientFields, predicateRows],
  );

  async function handleCreate(): Promise<void> {
    const currentEntry = entityEntryRef.current;
    const input = controller.getInput();
    const validation = currentEntry.validateCreate(input as never);

    if (!validation.ok) {
      setSubmitError(
        describeSyncError(new GraphValidationError(validation)) ?? "Create validation failed.",
      );
      return;
    }

    setBusy(true);
    setSubmitError("");

    try {
      const createdId = currentEntry.create(input as never);
      await runtime.sync.flush();
      onCreated(createdId);
    } catch (error) {
      setSubmitError(describeSyncError(error) ?? "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!createPlan.supported) {
    return (
      <InspectorShell
        description="This entity type cannot be created from the client because required fields are owned by server-command or authority-only flows."
        state="new"
        status={`New ${entityEntry.name}`}
        title={`New ${entityEntry.name}`}
        typeLabel={entityEntry.name}
      >
        <EmptyState>Required deferred fields block generic create for this type.</EmptyState>
        <DeferredFieldSection fields={createPlan.requiredBlockingFields} />
      </InspectorShell>
    );
  }

  return (
    <InspectorShell
      description={`Create ${entityEntry.name.toLowerCase()} records through the same field editors used for live entities.`}
      state="new"
      status={`New ${entityEntry.name}`}
      title={`New ${entityEntry.name}`}
      typeLabel={entityEntry.name}
    >
      <InspectorFieldSection
        emptyMessage="No client-writable fields."
        hideMissingStatus
        rows={fieldRows}
        title="Fields"
      />

      <DeferredFieldSection fields={createPlan.deferredFields} />

      <Section title="Create">
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            The draft validates through the real graph handle before commit. After creation, you
            continue editing in the normal entity inspector.
          </p>

          {submitError ? (
            <div
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100"
              data-explorer-create-error="true"
            >
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              data-explorer-create-submit={entityEntry.id}
              disabled={busy}
              onClick={() => {
                void handleCreate();
              }}
              type="button"
            >
              {busy ? "Creating..." : `Create ${entityEntry.name}`}
            </Button>
            {onCancelCreate ? (
              <Button onClick={onCancelCreate} type="button" variant="outline">
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </Section>
    </InspectorShell>
  );
}
