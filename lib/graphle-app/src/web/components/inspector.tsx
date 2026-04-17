import { isSecretBackedField } from "@dpeek/graphle-app/graph";
import { RecordSurfaceLayout } from "@dpeek/graphle-surface/react-dom";
import {
  EntitySurfaceFieldSection,
  type EntitySurfaceFieldEditorRenderer,
  type EntitySurfaceFieldRow,
} from "@dpeek/graphle-surface/react-dom";
import { GraphIcon } from "@dpeek/graphle-module-core/react-dom";
import { Badge } from "@dpeek/graphle-web-ui/badge";
import { type ReactNode } from "react";

import type { EntitySurfaceMode } from "./entity-surface-plan.js";
import { SecretFieldEditor } from "./field-editor.js";
import type {
  ExplorerRuntime,
  FieldValidationMessage,
  SubmitSecretFieldMutation,
} from "./explorer/model.js";

export type InspectorFieldRow = EntitySurfaceFieldRow;

export function InspectorShell({
  badges,
  children,
  description,
  iconId,
  state,
  status,
  summaryItems = [],
  title,
  typeLabel,
}: {
  badges?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  iconId?: string;
  state: "entity" | "new" | "predicate" | "schema";
  status: string;
  summaryItems?: readonly string[];
  title: string;
  typeLabel: string;
}) {
  return (
    <div className="space-y-4" data-explorer-panel="inspector" data-explorer-state={state}>
      <RecordSurfaceLayout
        badges={badges}
        description={description}
        icon={
          typeof iconId === "string" && iconId.length > 0 ? (
            <GraphIcon className="text-muted-foreground size-12" iconId={iconId} />
          ) : undefined
        }
        status={
          <Badge
            className="border-border bg-muted/30 text-muted-foreground tracking-normal normal-case"
            data-explorer-inspector-status={status}
          >
            {status}
          </Badge>
        }
        summaryItems={summaryItems}
        title={<span data-explorer-inspector-title={title}>{title}</span>}
        titlePrefix={<span data-explorer-inspector-type={typeLabel}>{typeLabel}</span>}
      >
        {children}
      </RecordSurfaceLayout>
    </div>
  );
}

export function InspectorFieldSection({
  chrome = true,
  description,
  emptyMessage = "No shared fields are available for this selection.",
  hideMissingStatus = false,
  mode,
  rows,
  runtime,
  submitSecretField,
  title = "Fields",
  validationMessagesByPath,
}: {
  chrome?: boolean;
  description?: string;
  emptyMessage?: string;
  hideMissingStatus?: boolean;
  mode: EntitySurfaceMode;
  rows: readonly InspectorFieldRow[];
  runtime?: ExplorerRuntime;
  submitSecretField?: SubmitSecretFieldMutation;
  title?: string;
  validationMessagesByPath?: ReadonlyMap<string, readonly FieldValidationMessage[]>;
}) {
  const renderSecretEditor: EntitySurfaceFieldEditorRenderer | undefined =
    runtime && submitSecretField
      ? ({ callbacks, predicate }) =>
          isSecretBackedField(predicate.field) && predicate.field.cardinality !== "many" ? (
            <SecretFieldEditor
              callbacks={callbacks}
              predicate={predicate}
              runtime={runtime}
              submitSecretField={submitSecretField}
            />
          ) : undefined
      : undefined;

  return (
    <EntitySurfaceFieldSection
      chrome={chrome}
      description={description}
      emptyMessage={emptyMessage}
      hideMissingStatus={hideMissingStatus}
      mode={mode}
      mutationRuntime={runtime}
      renderEditor={renderSecretEditor}
      rows={rows}
      title={title}
      validationMessagesByPath={validationMessagesByPath}
    />
  );
}
