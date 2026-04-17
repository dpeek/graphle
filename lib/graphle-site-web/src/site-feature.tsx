import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  compareSiteItems,
  site,
  siteIconPresets,
  type SiteIconPreset,
} from "@dpeek/graphle-module-site";
import {
  createEntityDraftController,
  getPredicateEditorKind,
  getPredicateFieldMeta,
  usePredicateValue,
  type EntityDraftController,
} from "@dpeek/graphle-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dpeek/graphle-web-ui/alert-dialog";
import { Button } from "@dpeek/graphle-web-ui/button";
import { Checkbox } from "@dpeek/graphle-web-ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dpeek/graphle-web-ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@dpeek/graphle-web-ui/field";
import { Input } from "@dpeek/graphle-web-ui/input";
import { MarkdownRenderer } from "@dpeek/graphle-web-ui/markdown";
import { NativeSelect, NativeSelectOption } from "@dpeek/graphle-web-ui/native-select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@dpeek/graphle-web-ui/sidebar";
import { Textarea } from "@dpeek/graphle-web-ui/textarea";
import { TextTooltip, TooltipProvider } from "@dpeek/graphle-web-ui/tooltip";
import type { GraphleShellFeature } from "@dpeek/graphle-web-shell";
import {
  AtSignIcon,
  BookOpenIcon,
  Edit3Icon,
  ExternalLinkIcon,
  FileTextIcon,
  GithubIcon,
  GlobeIcon,
  GripVerticalIcon,
  LinkIcon,
  LinkedinIcon,
  MailIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RssIcon,
  SaveIcon,
  SunIcon,
  Trash2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useGraphleSiteTheme } from "./theme.js";
import type {
  GraphleSiteIconPreset,
  GraphleSiteItem,
  GraphleSiteItemInput,
  GraphleSiteItemOrderInput,
  GraphleSiteStatusSnapshot,
} from "./status.js";

export type GraphleSiteStatusState =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly snapshot: GraphleSiteStatusSnapshot }
  | { readonly state: "error"; readonly message: string };

export interface GraphleSiteFeatureOptions {
  readonly status: GraphleSiteStatusState;
  readonly onRefresh?: () => void;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItem>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrderInput[]) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<GraphleSiteItem>;
}

type SaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "error"; readonly message: string };

type SiteItemFieldKey =
  | "body"
  | "createdAt"
  | "excerpt"
  | "icon"
  | "path"
  | "pinned"
  | "publishedAt"
  | "sortOrder"
  | "tags"
  | "title"
  | "updatedAt"
  | "url"
  | "visibility";

type SiteItemRowRole = "body" | "hidden" | "meta" | "title";

type DraftPredicate = {
  readonly field: (typeof site.item.fields)[SiteItemFieldKey];
  get(): unknown;
  set?: (value: unknown) => void;
  clear?: () => void;
  replace?: (value: readonly unknown[]) => void;
  subscribe(listener: () => void): () => void;
};

type SiteItemRowPlan = {
  readonly key: SiteItemFieldKey;
  readonly label: string;
  readonly role: SiteItemRowRole;
  readonly field: (typeof site.item.fields)[SiteItemFieldKey];
  readonly editorKind?: string;
  readonly editable: boolean;
};

const siteItemRowKeys = [
  "title",
  "path",
  "url",
  "excerpt",
  "body",
  "visibility",
  "icon",
  "tags",
  "pinned",
  "sortOrder",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const satisfies readonly SiteItemFieldKey[];

const iconByPreset = {
  book: BookOpenIcon,
  email: MailIcon,
  github: GithubIcon,
  link: LinkIcon,
  linkedin: LinkedinIcon,
  note: FileTextIcon,
  rss: RssIcon,
  website: GlobeIcon,
  x: XIcon,
} satisfies Record<SiteIconPreset, LucideIcon>;

function labelForField(
  field: (typeof site.item.fields)[SiteItemFieldKey],
  fallback: string,
): string {
  const meta = getPredicateFieldMeta(field) as { readonly label?: string } | undefined;
  return meta?.label ?? fallback;
}

function roleForField(key: SiteItemFieldKey): SiteItemRowRole {
  if (key === "title") return "title";
  if (key === "body" || key === "excerpt" || key === "url" || key === "tags") return "body";
  if (key === "createdAt" || key === "updatedAt" || key === "publishedAt") return "meta";
  return "hidden";
}

function buildSiteItemRowPlan(): readonly SiteItemRowPlan[] {
  return siteItemRowKeys.map((key) => {
    const field = site.item.fields[key];
    return {
      key,
      field,
      label: labelForField(field, key),
      role: roleForField(key),
      editorKind: getPredicateEditorKind(field),
      editable: key !== "createdAt" && key !== "updatedAt",
    };
  });
}

const siteItemRows = buildSiteItemRowPlan();

function draftInputFromItem(item: GraphleSiteItem): Record<string, unknown> {
  return {
    title: item.title,
    path: item.path ?? "",
    url: item.url ?? "",
    excerpt: item.excerpt ?? "",
    body: item.body ?? "",
    visibility: item.visibility,
    icon: item.icon ?? "",
    tags: item.tags.map((tag) => tag.key),
    pinned: item.pinned,
    sortOrder: item.sortOrder,
    publishedAt: item.publishedAt ?? "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function createSiteItemDraftController(item: GraphleSiteItem): EntityDraftController {
  return createEntityDraftController({
    draftSubjectId: `site:item:draft:${item.id}`,
    fieldTree: site.item.fields,
    initialInput: draftInputFromItem(item),
    listEntities: () => [],
    resolveEntity: () => undefined,
    typeById: new Map(),
    validate: (input) => ({
      ok: true,
      phase: "local",
      event: "update",
      value: input,
      changedPredicateKeys: [],
    }),
  });
}

function predicateForRow(controller: EntityDraftController, key: SiteItemFieldKey): DraftPredicate {
  return (controller.fields as Record<SiteItemFieldKey, DraftPredicate>)[key];
}

function setPredicateValue(predicate: DraftPredicate, value: unknown): void {
  if (Array.isArray(value) && predicate.replace) {
    predicate.replace(value);
    return;
  }
  if (value === undefined && predicate.clear) {
    predicate.clear();
    return;
  }
  predicate.set?.(value);
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof URL) return value.toString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function optionalString(value: unknown): string | null {
  const trimmed = stringValue(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown): number | null {
  const trimmed = stringValue(value).trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new Error("Sort order must be a finite number.");
  return parsed;
}

function tagsFromValue(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => stringValue(tag).trim()).filter((tag) => tag.length > 0);
  }
  return stringValue(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function itemInputFromController(controller: EntityDraftController): GraphleSiteItemInput {
  const input = controller.getInput();
  const title = stringValue(input.title).trim();
  if (title.length === 0) throw new Error("Title is required.");

  return {
    title,
    path: optionalString(input.path),
    url: optionalString(input.url),
    excerpt: optionalString(input.excerpt),
    body: optionalString(input.body),
    visibility: input.visibility === "public" ? "public" : "private",
    icon: siteIconPresets.includes(input.icon as GraphleSiteIconPreset)
      ? (input.icon as GraphleSiteIconPreset)
      : null,
    tags: tagsFromValue(input.tags),
    pinned: input.pinned === true,
    sortOrder: optionalNumber(input.sortOrder),
    publishedAt: optionalString(input.publishedAt),
  };
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function iconForItem(item: GraphleSiteItem): LucideIcon {
  return item.icon ? iconByPreset[item.icon] : AtSignIcon;
}

function canRenderPortaledUi(): boolean {
  return typeof document !== "undefined";
}

function SiteIconTooltip({
  children,
  text,
}: {
  readonly children: ReactNode;
  readonly text: string;
}) {
  if (!canRenderPortaledUi()) return <>{children}</>;
  return <TextTooltip text={text}>{children}</TextTooltip>;
}

function LoadingSurface() {
  return (
    <main
      className="grid min-h-svh place-content-center gap-3 bg-background p-8 text-center text-foreground [&>*]:m-0"
      aria-busy="true"
    >
      <p>Loading</p>
    </main>
  );
}

function ErrorSurface({ message }: { readonly message: string }) {
  return (
    <main
      className="grid min-h-svh place-content-center gap-3 bg-background p-8 text-center text-foreground [&>*]:m-0"
      role="alert"
    >
      <h1>Site unavailable</h1>
      <p>{message}</p>
    </main>
  );
}

function RouteView({ snapshot }: { readonly snapshot: GraphleSiteStatusSnapshot }) {
  const route = snapshot.route;

  if (route.kind !== "item") {
    return (
      <article className="graphle-site-content-article" data-route-kind="not-found">
        <h1>Page not found</h1>
        <p className="graphle-site-excerpt">{route.message}</p>
      </article>
    );
  }

  const item = route.item;
  return <ItemView item={item} />;
}

function ItemView({ item }: { readonly item: GraphleSiteItem }) {
  const body = item.body?.trim();

  return (
    <article className="graphle-site-content-article" data-route-kind="item">
      {body ? (
        <MarkdownRenderer className="max-w-[48rem]" content={body} />
      ) : (
        <>
          <h1>{item.title}</h1>
          {item.excerpt ? <p className="graphle-site-excerpt">{item.excerpt}</p> : null}
          {item.url ? (
            <a className="graphle-site-outbound" href={item.url} rel="noreferrer" target="_blank">
              <ExternalLinkIcon aria-hidden={true} />
              <span>{item.url}</span>
            </a>
          ) : null}
          {item.tags.length ? (
            <p className="graphle-site-tag-line">{item.tags.map((tag) => tag.name).join(", ")}</p>
          ) : null}
        </>
      )}
    </article>
  );
}

function DraftTextControl({
  multiline,
  predicate,
  row,
}: {
  readonly multiline?: boolean;
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  const Control = multiline ? Textarea : Input;
  return (
    <Control
      aria-label={row.label}
      data-site-field={row.key}
      rows={row.key === "body" ? 14 : 3}
      value={stringValue(value)}
      onChange={(event) => setPredicateValue(predicate, event.currentTarget.value)}
    />
  );
}

function DraftSelectControl({
  children,
  predicate,
  row,
}: {
  readonly children: ReactNode;
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  return (
    <NativeSelect
      aria-label={row.label}
      className="graphle-site-select-control"
      value={stringValue(value)}
      onChange={(event) => setPredicateValue(predicate, event.currentTarget.value)}
    >
      {children}
    </NativeSelect>
  );
}

function DraftTagsControl({
  predicate,
  row,
}: {
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  return (
    <Input
      aria-label={row.label}
      value={tagsFromValue(value).join(", ")}
      onChange={(event) =>
        setPredicateValue(
          predicate,
          event.currentTarget.value
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        )
      }
    />
  );
}

function DraftBooleanControl({
  predicate,
  row,
}: {
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  return (
    <Checkbox
      aria-label={row.label}
      checked={value === true}
      onCheckedChange={(checked) => setPredicateValue(predicate, checked)}
    />
  );
}

function DraftNumberControl({
  predicate,
  row,
}: {
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  return (
    <Input
      aria-label={row.label}
      type="number"
      value={stringValue(value)}
      onChange={(event) =>
        setPredicateValue(
          predicate,
          event.currentTarget.value.trim().length === 0
            ? undefined
            : Number(event.currentTarget.value),
        )
      }
    />
  );
}

function DraftReadonlyControl({
  predicate,
  row,
}: {
  readonly predicate: DraftPredicate;
  readonly row: SiteItemRowPlan;
}) {
  const value: unknown = usePredicateValue(predicate as any);
  return (
    <Input
      aria-label={row.label}
      readOnly={true}
      value={stringValue(value)}
      data-site-field-readonly="true"
    />
  );
}

function DraftControl({
  controller,
  row,
}: {
  readonly controller: EntityDraftController;
  readonly row: SiteItemRowPlan;
}) {
  const predicate = predicateForRow(controller, row.key);

  if (!row.editable) return <DraftReadonlyControl predicate={predicate} row={row} />;

  switch (row.key) {
    case "body":
    case "excerpt":
      return <DraftTextControl multiline={true} predicate={predicate} row={row} />;
    case "visibility":
      return (
        <DraftSelectControl predicate={predicate} row={row}>
          <NativeSelectOption value="private">Private</NativeSelectOption>
          <NativeSelectOption value="public">Public</NativeSelectOption>
        </DraftSelectControl>
      );
    case "icon":
      return (
        <DraftSelectControl predicate={predicate} row={row}>
          <NativeSelectOption value="">None</NativeSelectOption>
          {siteIconPresets.map((preset) => (
            <NativeSelectOption key={preset} value={preset}>
              {preset}
            </NativeSelectOption>
          ))}
        </DraftSelectControl>
      );
    case "pinned":
      return <DraftBooleanControl predicate={predicate} row={row} />;
    case "sortOrder":
      return <DraftNumberControl predicate={predicate} row={row} />;
    case "tags":
      return <DraftTagsControl predicate={predicate} row={row} />;
    default:
      return <DraftTextControl predicate={predicate} row={row} />;
  }
}

function SaveError({ state }: { readonly state: SaveState }) {
  if (state.kind !== "error") return null;
  return <FieldError>{state.message}</FieldError>;
}

function ItemEditor({
  item,
  onAfterSave,
  onSave,
}: {
  readonly item: GraphleSiteItem;
  readonly onAfterSave: (item: GraphleSiteItem) => void;
  readonly onSave?: (id: string, input: GraphleSiteItemInput) => Promise<GraphleSiteItem>;
}) {
  const [controller, setController] = useState(() => createSiteItemDraftController(item));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const itemVersion = `${item.id}:${item.updatedAt}`;

  useEffect(() => {
    setController(createSiteItemDraftController(item));
    setSaveState({ kind: "idle" });
  }, [itemVersion, item]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ kind: "saving" });
    try {
      const updated = await onSave?.(item.id, itemInputFromController(controller));
      controller.session.commit();
      if (updated) onAfterSave(updated);
      setSaveState({ kind: "idle" });
    } catch (error) {
      setSaveState({ kind: "error", message: messageForError(error) });
    }
  }

  return (
    <form className="grid w-full min-w-0 justify-stretch gap-5" onSubmit={submit}>
      <FieldGroup className="w-full min-w-0">
        {siteItemRows.map((row) => (
          <Field
            className="graphle-site-editor-row w-full min-w-0"
            data-site-field-role={row.role}
            key={row.key}
          >
            <FieldLabel className="graphle-site-sr-only">{row.label}</FieldLabel>
            <DraftControl controller={controller} row={row} />
          </Field>
        ))}
      </FieldGroup>
      <div className="flex max-w-[46rem] flex-wrap items-center gap-3">
        <Button disabled={saveState.kind === "saving"} type="submit">
          <SaveIcon aria-hidden={true} data-icon="inline-start" />
          Save
        </Button>
        <SaveError state={saveState} />
      </div>
    </form>
  );
}

function selectedContentItem({
  editItemId,
  snapshot,
}: {
  readonly editItemId: string | null;
  readonly snapshot: GraphleSiteStatusSnapshot;
}): GraphleSiteItem | undefined {
  if (editItemId) return snapshot.items.find((item) => item.id === editItemId);
  return snapshot.route.kind === "item" ? snapshot.route.item : undefined;
}

export function buildGraphleSiteOrderPayload(
  items: readonly GraphleSiteItem[],
): readonly GraphleSiteItemOrderInput[] {
  return items.map((item, index) => ({
    id: item.id,
    sortOrder: index,
  }));
}

function SortableItemRow({
  active,
  authenticated,
  item,
  onDelete,
  onEdit,
  onNavigate,
}: {
  readonly active: boolean;
  readonly authenticated: boolean;
  readonly item: GraphleSiteItem;
  readonly onDelete: (item: GraphleSiteItem) => void;
  readonly onEdit: (item: GraphleSiteItem) => void;
  readonly onNavigate: (item: GraphleSiteItem, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
    disabled: !authenticated,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } satisfies CSSProperties;
  const Icon = iconForItem(item);
  const external = !item.path && Boolean(item.url);
  const href = item.path ?? item.url ?? "#";

  return (
    <SidebarMenuItem
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-0.5 data-[dragging=true]:opacity-70"
      data-dragging={isDragging ? "true" : undefined}
      ref={setNodeRef}
      style={style}
    >
      {authenticated ? (
        <button
          aria-label={`Reorder ${item.title}`}
          className="inline-flex size-6 items-center justify-center rounded-sm border-0 bg-transparent text-sidebar-foreground opacity-100 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground md:opacity-0 md:group-focus-within/menu-item:opacity-100 md:group-hover/menu-item:opacity-100"
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden={true} />
        </button>
      ) : null}
      <SidebarMenuButton
        className="min-w-0"
        isActive={active}
        render={
          <a
            href={href}
            onClick={(event) => onNavigate(item, event)}
            rel={external ? "noreferrer" : undefined}
            target={external ? "_blank" : undefined}
          />
        }
        tooltip={canRenderPortaledUi() ? item.title : undefined}
      >
        <Icon aria-hidden={true} />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {authenticated && canRenderPortaledUi() ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${item.title}`}
            render={<SidebarMenuAction showOnHover={true} />}
          >
            <MoreHorizontalIcon aria-hidden={true} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit3Icon aria-hidden={true} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(item)} variant="destructive">
                <Trash2Icon aria-hidden={true} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : authenticated ? (
        <SidebarMenuAction aria-label={`Actions for ${item.title}`} showOnHover={true}>
          <MoreHorizontalIcon aria-hidden={true} />
        </SidebarMenuAction>
      ) : null}
    </SidebarMenuItem>
  );
}

function ItemSidebar({
  activeItemId,
  authenticated,
  items,
  onCreate,
  onDelete,
  onEdit,
  onNavigate,
  onReorder,
}: {
  readonly activeItemId?: string;
  readonly authenticated: boolean;
  readonly items: readonly GraphleSiteItem[];
  readonly onCreate: () => void;
  readonly onDelete: (item: GraphleSiteItem) => void;
  readonly onEdit: (item: GraphleSiteItem) => void;
  readonly onNavigate: (item: GraphleSiteItem, event: MouseEvent<HTMLAnchorElement>) => void;
  readonly onReorder?: (items: readonly GraphleSiteItemOrderInput[]) => Promise<void>;
}) {
  const sortedItems = useMemo(() => [...items].sort(compareSiteItems), [items]);
  const [orderedIds, setOrderedIds] = useState<readonly string[]>(() =>
    sortedItems.map((item) => item.id),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setOrderedIds(sortedItems.map((item) => item.id));
  }, [sortedItems]);

  const renderIds = [
    ...orderedIds,
    ...sortedItems.map((item) => item.id).filter((id) => !orderedIds.includes(id)),
  ];
  const sortedByLocalOrder = renderIds
    .map((id) => sortedItems.find((item) => item.id === id))
    .filter((item): item is GraphleSiteItem => Boolean(item));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = renderIds.indexOf(String(active.id));
    const newIndex = renderIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove([...renderIds], oldIndex, newIndex);
    setOrderedIds(nextIds);
    const nextItems = nextIds
      .map((id) => sortedItems.find((item) => item.id === id))
      .filter((item): item is GraphleSiteItem => Boolean(item));
    await onReorder?.(buildGraphleSiteOrderPayload(nextItems));
  }

  const menu = (
    <SidebarMenu>
      {sortedByLocalOrder.map((item) => (
        <SortableItemRow
          active={item.id === activeItemId}
          authenticated={authenticated}
          item={item}
          key={item.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onNavigate={onNavigate}
        />
      ))}
    </SidebarMenu>
  );

  return (
    <>
      <SidebarHeader className="items-end">
        {authenticated ? (
          <SiteIconTooltip text="Create item">
            <Button aria-label="Create item" onClick={onCreate} size="icon-sm" type="button">
              <PlusIcon aria-hidden={true} />
            </Button>
          </SiteIconTooltip>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        {authenticated ? (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              void handleDragEnd(event);
            }}
            sensors={sensors}
          >
            <SortableContext items={renderIds} strategy={verticalListSortingStrategy}>
              {menu}
            </SortableContext>
          </DndContext>
        ) : (
          menu
        )}
      </SidebarContent>
    </>
  );
}

function ThemeToggle() {
  const theme = useGraphleSiteTheme();
  const Icon = theme.resolved === "dark" ? SunIcon : MoonIcon;

  return (
    <SiteIconTooltip text={theme.resolved === "dark" ? "Use light theme" : "Use dark theme"}>
      <Button
        aria-label={theme.resolved === "dark" ? "Use light theme" : "Use dark theme"}
        onClick={theme.toggle}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden={true} />
      </Button>
    </SiteIconTooltip>
  );
}

function DeleteConfirmDialog({
  item,
  onConfirm,
  onOpenChange,
}: {
  readonly item: GraphleSiteItem | null;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>
            {item ? `Delete "${item.title}" from this site?` : "Delete this item?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReadySitePreview({
  snapshot,
  onCreateBlankItem,
  onDeleteItem,
  onNavigatePath,
  onReorderItems,
  onUpdateItem,
}: {
  readonly snapshot: GraphleSiteStatusSnapshot;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItem>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrderInput[]) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<GraphleSiteItem>;
}) {
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<GraphleSiteItem | null>(null);
  const activeItem = selectedContentItem({ editItemId, snapshot });
  const routeItemId = snapshot.route.kind === "item" ? snapshot.route.item.id : undefined;
  const isEditing = snapshot.session.authenticated && editItemId !== null && activeItem;

  function navigateToItem(item: GraphleSiteItem, event: MouseEvent<HTMLAnchorElement>) {
    if (!item.path) return;
    event.preventDefault();
    setEditItemId(null);
    void onNavigatePath?.(item.path);
  }

  function editItem(item: GraphleSiteItem) {
    setEditItemId(item.id);
    if (item.path && item.path !== snapshot.route.path) {
      void onNavigatePath?.(item.path);
    }
  }

  async function createBlankItem() {
    const created = await onCreateBlankItem?.();
    if (!created) return;
    setEditItemId(created.id);
    if (created.path) await onNavigatePath?.(created.path);
  }

  async function confirmDelete() {
    const item = deleteItem;
    if (!item) return;
    setDeleteItem(null);
    await onDeleteItem?.(item.id);
    if (editItemId === item.id || routeItemId === item.id) {
      setEditItemId(null);
      await onNavigatePath?.("/");
    }
  }

  async function afterSave(item: GraphleSiteItem) {
    setEditItemId(item.id);
    if (item.path) {
      await onNavigatePath?.(item.path);
      return;
    }
    if (routeItemId === item.id) {
      await onNavigatePath?.("/");
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        className="flex-col md:flex-row"
        style={{ "--sidebar-width": "15rem" } as CSSProperties}
      >
        <Sidebar
          collapsible="none"
          className="!h-auto !min-h-0 !w-full overflow-visible border-b md:sticky md:top-0 md:!h-svh md:!min-h-svh md:!w-[var(--sidebar-width)] md:overflow-hidden md:border-b-0"
          variant="sidebar"
        >
          <ItemSidebar
            activeItemId={editItemId ?? routeItemId}
            authenticated={snapshot.session.authenticated}
            items={snapshot.items}
            onCreate={() => {
              void createBlankItem();
            }}
            onDelete={setDeleteItem}
            onEdit={editItem}
            onNavigate={navigateToItem}
            onReorder={onReorderItems}
          />
          <SidebarFooter className="items-end border-t border-sidebar-border">
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <main className="mx-auto block min-h-0 w-full max-w-[52rem] px-5 py-8 md:min-h-svh md:px-[clamp(1.25rem,4vw,3.5rem)] md:py-[clamp(2rem,6vw,5rem)]">
            {isEditing && activeItem ? (
              <ItemEditor item={activeItem} onAfterSave={afterSave} onSave={onUpdateItem} />
            ) : (
              <RouteView snapshot={snapshot} />
            )}
          </main>
        </SidebarInset>
        <DeleteConfirmDialog
          item={deleteItem}
          onConfirm={() => {
            void confirmDelete();
          }}
          onOpenChange={(open) => {
            if (!open) setDeleteItem(null);
          }}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function GraphleSitePreview({
  status,
  onCreateBlankItem,
  onDeleteItem,
  onNavigatePath,
  onReorderItems,
  onUpdateItem,
}: GraphleSiteFeatureOptions) {
  if (status.state === "loading") return <LoadingSurface />;
  if (status.state === "error") return <ErrorSurface message={status.message} />;

  return (
    <ReadySitePreview
      snapshot={status.snapshot}
      onCreateBlankItem={onCreateBlankItem}
      onDeleteItem={onDeleteItem}
      onNavigatePath={onNavigatePath}
      onReorderItems={onReorderItems}
      onUpdateItem={onUpdateItem}
    />
  );
}

function activePagePath(status: GraphleSiteStatusState): string {
  return status.state === "ready" ? status.snapshot.route.path : "/";
}

export function createGraphleSiteFeature(options: GraphleSiteFeatureOptions): GraphleShellFeature {
  return {
    id: "site",
    label: "Site",
    order: 10,
    navigation: [],
    commands: [],
    pages: [
      {
        id: "site",
        label: "Site",
        path: activePagePath(options.status),
        order: 10,
        render: () => <GraphleSitePreview {...options} />,
      },
    ],
  };
}
