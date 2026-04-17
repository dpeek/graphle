import { isSecretBackedField } from "@dpeek/graphle-app/graph";
import {
  buildEntitySurfaceFieldRows,
  EntitySurface as SharedEntitySurface,
  type EntitySurfaceFieldEditorRenderer,
} from "@dpeek/graphle-surface/react-dom";

import { iconTypeId } from "./explorer/model.js";
import type {
  AnyEntityRef,
  EntityCatalogEntry,
  ExplorerRuntime,
  SubmitSecretFieldMutation,
} from "./explorer/model.js";
import { SecretFieldEditor } from "./field-editor.js";
import type { EntitySurfaceMode } from "./entity-surface-plan.js";

function resolveEntityPreviewIconId(
  entityId: string,
  iconSlotValue: string | undefined,
  typeEntry: EntityCatalogEntry,
): string | undefined {
  if (typeEntry.id === iconTypeId) return entityId;
  return typeEntry.iconPredicateId ? iconSlotValue : undefined;
}

export function EntitySurface({
  defaultMode = "edit",
  entity,
  mode,
  onModeChange,
  runtime,
  showModeToggle = true,
  submitSecretField,
}: {
  defaultMode?: EntitySurfaceMode;
  entity: AnyEntityRef;
  mode?: EntitySurfaceMode;
  onModeChange?: (mode: EntitySurfaceMode) => void;
  runtime: ExplorerRuntime;
  showModeToggle?: boolean;
  submitSecretField: SubmitSecretFieldMutation;
}) {
  const renderSecretEditor: EntitySurfaceFieldEditorRenderer = ({ callbacks, predicate }) =>
    isSecretBackedField(predicate.field) && predicate.field.cardinality !== "many" ? (
      <SecretFieldEditor
        callbacks={callbacks}
        predicate={predicate}
        runtime={runtime}
        submitSecretField={submitSecretField}
      />
    ) : undefined;

  return (
    <SharedEntitySurface
      defaultMode={defaultMode}
      entity={entity}
      mode={mode}
      mutationRuntime={runtime}
      onModeChange={onModeChange}
      renderEditor={renderSecretEditor}
      showModeToggle={showModeToggle}
    />
  );
}

export { buildEntitySurfaceFieldRows, resolveEntityPreviewIconId };
