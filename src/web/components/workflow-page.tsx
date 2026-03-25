"use client";

import { typeId } from "@io/core/graph";
import { ops } from "@io/core/graph/modules/ops";

import { GraphAccessGate } from "./auth-shell.js";
import { EntityTypeBrowser } from "./entity-type-browser.js";
import { GraphRuntimeBootstrap } from "./graph-runtime-bootstrap.js";

const workflowBranchTypeId = typeId(ops.workflowBranch);

export function WorkflowPage() {
  return (
    <GraphAccessGate
      description="Resolve an authenticated Better Auth session before booting the workflow view against /api/sync and /api/tx."
      title="Sign in to open workflow"
    >
      <GraphRuntimeBootstrap>
        <div className="flex min-h-0 flex-1 flex-col gap-4" data-workflow-page="">
          <h1 className="text-3xl font-semibold tracking-tight">Workflow</h1>
          <EntityTypeBrowser title="Branches" typeId={workflowBranchTypeId} />
        </div>
      </GraphRuntimeBootstrap>
    </GraphAccessGate>
  );
}
