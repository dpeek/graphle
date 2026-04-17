import { typeId } from "@dpeek/graphle-app/graph";
import { CreateEntitySurfaceBody } from "@dpeek/graphle-surface/react-dom";
import { Button } from "@dpeek/graphle-web-ui/button";
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@dpeek/graphle-web-ui/dialog";
import { XIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

import { buildCreateDefaults } from "./explorer/create-draft-plan.js";
import { explorerNamespace } from "./explorer/model.js";
import type { EntityCatalogEntry, ExplorerRuntime } from "./explorer/model.js";

export function CreateEntitySurface({
  entityEntry,
  entityEntryById,
  onCreated,
  runtime,
}: {
  entityEntry: EntityCatalogEntry;
  entityEntryById: ReadonlyMap<string, EntityCatalogEntry>;
  onCreated: (entityId: string) => void;
  runtime: ExplorerRuntime;
}) {
  const entityEntryByIdRef = useRef(entityEntryById);
  entityEntryByIdRef.current = entityEntryById;

  const typeById = useMemo(
    () => new Map(Object.values(explorerNamespace).map((typeDef) => [typeId(typeDef), typeDef])),
    [],
  );
  const createDefaults = useMemo(
    () => buildCreateDefaults(entityEntry, typeById),
    [entityEntry, typeById],
  );
  const createLabel = `Create ${entityEntry.name}`;
  const listEntities = useCallback((rangeTypeId: string) => {
    const rangeEntry = entityEntryByIdRef.current.get(rangeTypeId);
    return rangeEntry ? rangeEntry.ids.map((id) => rangeEntry.getRef(id)) : [];
  }, []);
  const resolveEntity = useCallback((rangeTypeId: string, id: string) => {
    const rangeEntry = entityEntryByIdRef.current.get(rangeTypeId);
    return rangeEntry ? rangeEntry.getRef(id) : undefined;
  }, []);

  return (
    <div
      className="flex max-h-full min-h-0 flex-col"
      data-create-entity-surface={entityEntry.id}
      data-entity-surface="create"
    >
      <DialogHeader className="border-border/60 flex-row items-center justify-between gap-3 border-b px-4 py-3">
        <DialogTitle className="text-base font-semibold">{createLabel}</DialogTitle>
        <DialogClose
          render={
            <Button aria-label="Close create dialog" size="icon-sm" type="button" variant="ghost" />
          }
        >
          <XIcon />
        </DialogClose>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <CreateEntitySurfaceBody
          create={entityEntry.create}
          createDefaults={createDefaults}
          draftSubjectId={`draft:${entityEntry.id}`}
          fieldTree={entityEntry.typeDef.fields as Record<string, unknown>}
          listEntities={listEntities}
          mutationRuntime={runtime}
          onCreated={onCreated}
          renderActions={(state) => (
            <DialogFooter className="border-border/60 -mx-4 -mb-4 border-t px-4 py-3">
              <Button
                data-explorer-create-submit={entityEntry.id}
                disabled={state.busy || !state.supported}
                onClick={() => {
                  void state.submit();
                }}
                type="button"
              >
                {state.busy ? "Creating..." : createLabel}
              </Button>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            </DialogFooter>
          )}
          resolveEntity={resolveEntity}
          submitLabel={createLabel}
          typeById={typeById}
          validateCreate={entityEntry.validateCreate}
        />
      </div>
    </div>
  );
}
