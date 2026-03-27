import { isSecretBackedField } from "@io/graph-kernel";

import {
  defineDefaultEnumTypeModule,
  defineEnum,
  defineReferenceField,
  defineScalar,
  defineScalarModule,
  defineSecretField,
  defineType,
  defineValidatedStringTypeModule,
  existingEntityReferenceField,
  type GraphCommandSpec,
  type GraphSecretFieldAuthority,
  type ObjectViewSpec,
  type TypeModule,
  type WorkflowSpec,
} from "./index.js";

const probeStringType = defineScalar({
  values: { key: "probe:string", name: "Probe String" },
  encode: (value: string) => value,
  decode: (raw) => raw,
});

const probeBooleanType = defineScalar({
  values: { key: "probe:boolean", name: "Probe Boolean" },
  encode: (value: boolean) => (value ? "true" : "false"),
  decode: (raw) => raw === "true",
});

const probeEntityType = defineType({
  values: { key: "probe:entity", name: "Probe Entity" },
  fields: {},
});

const probeSecretHandleType = defineType({
  values: { key: "probe:secretHandle", name: "Probe Secret Handle" },
  fields: {},
});

const probeStatusType = defineEnum({
  values: { key: "probe:status", name: "Probe Status" },
  options: {
    active: { name: "Active" },
    paused: { name: "Paused" },
  },
});

const probeStatusTypeModule = defineDefaultEnumTypeModule(probeStatusType);

const probeStringTypeModule = defineValidatedStringTypeModule({
  values: { key: "probe:validatedString", name: "Probe Validated String" },
  parse: (raw: string) => raw.trim(),
  filter: {
    defaultOperator: "equals",
    operators: {
      equals: {
        label: "Equals",
        operand: {
          kind: "string",
        },
        parse: (raw: string) => raw.trim(),
        format: (operand: string) => operand,
        test: (value: string, operand: string) => value === operand,
      },
      contains: {
        label: "Contains",
        operand: {
          kind: "string",
        },
        parse: (raw: string) => raw.trim(),
        format: (operand: string) => operand,
        test: (value: string, operand: string) => value.includes(operand),
      },
    },
  },
});

const probeBooleanTypeModule = defineScalarModule({
  type: probeBooleanType,
  meta: {
    display: {
      kind: "boolean",
      allowed: ["boolean", "text"] as const,
    },
    editor: {
      kind: "checkbox",
      allowed: ["checkbox", "switch"] as const,
    },
  },
  filter: {
    defaultOperator: "is",
    operators: {
      is: {
        label: "Is",
        operand: {
          kind: "boolean",
        },
        parse: (raw: string) => raw === "true",
        format: (operand: boolean) => String(operand),
        test: (value: boolean, operand: boolean) => value === operand,
      },
      isNot: {
        label: "Is not",
        operand: {
          kind: "boolean",
        },
        parse: (raw: string) => raw === "true",
        format: (operand: boolean) => String(operand),
        test: (value: boolean, operand: boolean) => value !== operand,
      },
    },
  },
});

void (probeBooleanTypeModule satisfies TypeModule<any, any, any>);

void defineReferenceField({
  range: probeEntityType,
  cardinality: "many",
});

void existingEntityReferenceField(probeEntityType, {
  cardinality: "many",
  label: "Related entities",
});

void existingEntityReferenceField(probeEntityType, {
  cardinality: "many",
  collection: "unordered",
  create: true,
  editorKind: "entity-reference-combobox",
  label: "Searchable related entities",
});

const secretField = defineSecretField({
  range: probeSecretHandleType,
  cardinality: "one?",
  revealCapability: "secret:reveal",
  rotateCapability: "secret:rotate",
});

void (secretField.authority.secret satisfies GraphSecretFieldAuthority);

if (isSecretBackedField(secretField)) {
  void (secretField.authority.secret satisfies GraphSecretFieldAuthority);
  void secretField.authority.secret.revealCapability;
  void secretField.authority.secret.rotateCapability;

  // @ts-expect-error transport details stay out of the shared secret-field authority contract
  void secretField.authority.secret.command;
}

void probeStringTypeModule.field({
  cardinality: "one",
  authority: {
    visibility: "authority-only",
    write: "authority-only",
  },
  meta: {
    editor: {
      kind: "text",
      multiline: true,
    },
  },
});

void probeStringTypeModule.field({
  cardinality: "one",
  meta: {
    editor: {
      // @ts-expect-error string fields cannot switch to an unrelated editor kind
      kind: "checkbox",
    },
  },
});

void probeStringTypeModule.field({
  cardinality: "one",
  filter: {
    // @ts-expect-error string fields cannot narrow to unknown filter operators
    operators: ["gt"] as const,
  },
});

void probeStatusTypeModule.field({
  cardinality: "one",
  filter: {
    operators: ["is"] as const,
    // @ts-expect-error the chosen default operator must belong to the narrowed operator set
    defaultOperator: "oneOf",
  },
});

void probeBooleanTypeModule.field({
  cardinality: "one?",
  meta: {
    editor: {
      kind: "switch",
    },
  },
});

void probeBooleanTypeModule.field({
  cardinality: "one?",
  meta: {
    editor: {
      // @ts-expect-error boolean fields cannot switch to text editing semantics
      kind: "text",
    },
  },
});

void defineScalarModule({
  type: probeStringType,
  meta: {
    summary: {
      kind: "value",
      // @ts-expect-error scalar metadata formatters must align with the decoded scalar value type
      format: (value: number) => String(value),
    },
    display: {
      kind: "text",
      allowed: ["text"] as const,
      format: (value: string) => value,
    },
    editor: {
      kind: "text",
      allowed: ["text"] as const,
    },
  },
  filter: {
    defaultOperator: "equals",
    operators: {
      equals: {
        label: "Equals",
        operand: {
          kind: "string",
        },
        parse: (raw: string) => raw,
        format: (operand: string) => operand,
        test: (value: string, operand: string) => value === operand,
      },
    },
  },
});

void ({
  key: "probe:view",
  entity: probeEntityType.values.key,
  titleField: "name",
  sections: [
    {
      key: "summary",
      title: "Summary",
      fields: [{ path: "name", label: "Name", span: 2 }],
    },
  ],
  commands: ["probe:save"],
} satisfies ObjectViewSpec);

void ({
  key: "probe:save",
  label: "Save probe",
  subject: probeEntityType.values.key,
  execution: "optimisticVerify",
  input: {
    name: "Probe",
  },
  output: {
    itemId: "probe-1",
  },
} satisfies GraphCommandSpec<{ name: string }, { itemId: string }>);

void ({
  key: "probe:workflow",
  label: "Probe workflow",
  description: "Review a probe entity.",
  subjects: [probeEntityType.values.key],
  steps: [
    {
      key: "review",
      title: "Review",
      objectView: "probe:view",
    },
    {
      key: "save",
      title: "Save",
      command: "probe:save",
    },
  ],
  commands: ["probe:save"],
} satisfies WorkflowSpec);
