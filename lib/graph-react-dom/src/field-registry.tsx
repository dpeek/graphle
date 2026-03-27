import {
  formatPredicateValue,
  usePredicateField,
  type PredicateFieldProps,
  type PredicateFieldViewCapability,
} from "@io/graph-react";

import { colorFieldViewCapability } from "./fields/color.js";
import { markdownFieldViewCapability } from "./fields/markdown.js";
import { percentFieldViewCapability } from "./fields/percent.js";
import { svgFieldViewCapability } from "./fields/svg.js";

type AnyFieldProps = PredicateFieldProps<any, any>;

function BooleanFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);

  if (Array.isArray(value)) {
    return <span data-web-field-status="unsupported">unsupported-display-kind:boolean</span>;
  }

  return (
    <input
      aria-label={formatPredicateValue(predicate, value)}
      checked={value === true}
      data-web-field-kind="boolean"
      disabled
      readOnly
      type="checkbox"
    />
  );
}

function TextFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  return <span data-web-field-kind="text">{formatPredicateValue(predicate, value)}</span>;
}

function NumberFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  return <span data-web-field-kind="number">{formatPredicateValue(predicate, value)}</span>;
}

function DateFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  if (!(value instanceof Date)) {
    return <span data-web-field-kind="date">{formatPredicateValue(predicate, value)}</span>;
  }

  const formatted = formatPredicateValue(predicate, value);
  return (
    <time data-web-field-kind="date" dateTime={value.toISOString()}>
      {formatted}
    </time>
  );
}

function LinkFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  if (!(value instanceof URL)) {
    return <span data-web-field-kind="link">{formatPredicateValue(predicate, value)}</span>;
  }

  const href = value.toString();
  return (
    <a data-web-field-kind="link" href={href}>
      {formatPredicateValue(predicate, value)}
    </a>
  );
}

function ExternalLinkFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  if (!(value instanceof URL)) {
    return (
      <span data-web-field-kind="external-link">{formatPredicateValue(predicate, value)}</span>
    );
  }

  const href = value.toString();
  return (
    <a data-web-field-kind="external-link" href={href} rel="noreferrer" target="_blank">
      {formatPredicateValue(predicate, value)}
    </a>
  );
}

function BadgeFieldView({ predicate }: AnyFieldProps) {
  const { value } = usePredicateField(predicate);
  return <span data-web-field-kind="badge">{formatPredicateValue(predicate, value)}</span>;
}

/** Built-in browser field view capabilities for the current DOM adapter. */
export const genericWebFieldViewCapabilities = [
  { kind: "boolean", Component: BooleanFieldView },
  colorFieldViewCapability,
  { kind: "text", Component: TextFieldView },
  markdownFieldViewCapability,
  svgFieldViewCapability,
  { kind: "date", Component: DateFieldView },
  { kind: "number", Component: NumberFieldView },
  percentFieldViewCapability,
  { kind: "link", Component: LinkFieldView },
  { kind: "external-link", Component: ExternalLinkFieldView },
  { kind: "badge", Component: BadgeFieldView },
] satisfies readonly PredicateFieldViewCapability<any, any>[];

export { genericWebFieldEditorCapabilities } from "./fields/index.js";
