import type { GraphCommandPolicy } from "@io/graph-authority";

/**
 * One field row inside an authored object-view section.
 */
export type ObjectViewFieldSpec = {
  readonly path: string;
  readonly label?: string;
  readonly description?: string;
  readonly span?: 1 | 2;
};

/**
 * One section inside an authored object view.
 */
export type ObjectViewSectionSpec = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly ObjectViewFieldSpec[];
};

/**
 * Related-entity presentation metadata attached to an object view.
 */
export type ObjectViewRelatedSpec = {
  readonly key: string;
  readonly title: string;
  readonly relationPath: string;
  readonly presentation: "list" | "table" | "board";
};

/**
 * Pure, host-neutral object presentation contract authored beside one type or
 * small module slice.
 */
export type ObjectViewSpec = {
  readonly key: string;
  readonly entity: string;
  readonly titleField?: string;
  readonly subtitleField?: string;
  readonly sections: readonly ObjectViewSectionSpec[];
  readonly related?: readonly ObjectViewRelatedSpec[];
  readonly commands?: readonly string[];
};

/**
 * One declarative step inside a workflow descriptor.
 */
export type WorkflowStepSpec = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly objectView?: string;
  readonly command?: string;
};

/**
 * Pure, host-neutral workflow descriptor that binds subjects, steps, object
 * views, and command affordances together.
 */
export type WorkflowSpec = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly subjects: readonly string[];
  readonly steps: readonly WorkflowStepSpec[];
  readonly commands?: readonly string[];
};

/**
 * Execution strategies supported by authored graph command descriptors.
 */
export type GraphCommandExecution = "localOnly" | "optimisticVerify" | "serverOnly";

/**
 * Authored command manifest contract. Policy enforcement remains
 * authority-owned; this type only describes the module-authored command shape.
 */
export type GraphCommandSpec<Input = unknown, Output = unknown> = {
  readonly key: string;
  readonly label: string;
  readonly subject?: string;
  readonly execution: GraphCommandExecution;
  readonly input: Input;
  readonly output: Output;
  readonly policy?: GraphCommandPolicy;
};
