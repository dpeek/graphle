import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { GraphleShellErrorState, GraphleShellLoadingState } from "@dpeek/graphle-web-shell";
import type { GraphleShellFeature } from "@dpeek/graphle-web-shell";
import {
  compareSiteItems,
  siteIconPresets,
  siteItemMatchesSearch,
} from "@dpeek/graphle-module-site";
import { Badge } from "@dpeek/graphle-web-ui/badge";
import { Button } from "@dpeek/graphle-web-ui/button";
import { Input } from "@dpeek/graphle-web-ui/input";
import { MarkdownRenderer } from "@dpeek/graphle-web-ui/markdown";
import { Textarea } from "@dpeek/graphle-web-ui/textarea";
import {
  BookmarkIcon,
  Edit3Icon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  PinIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
} from "lucide-react";

import type {
  GraphleSiteIconPreset,
  GraphleSiteItem,
  GraphleSiteItemInput,
  GraphleSiteStatusSnapshot,
  GraphleSiteVisibility,
} from "./status.js";

export type GraphleSiteStatusState =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly snapshot: GraphleSiteStatusSnapshot }
  | { readonly state: "error"; readonly message: string };

export interface GraphleSiteFeatureOptions {
  readonly status: GraphleSiteStatusState;
  readonly onRefresh?: () => void;
  readonly onCreateItem?: (input: GraphleSiteItemInput) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<void>;
}

type SaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "error"; readonly message: string };

type EditorMode =
  | { readonly kind: "create"; readonly draft: ItemDraft }
  | { readonly kind: "edit"; readonly id: string };

interface ItemDraft {
  readonly title: string;
  readonly path: string;
  readonly url: string;
  readonly excerpt: string;
  readonly body: string;
  readonly visibility: GraphleSiteVisibility;
  readonly icon: "" | GraphleSiteIconPreset;
  readonly tags: string;
  readonly pinned: boolean;
  readonly sortOrder: string;
}

const emptyDraft: ItemDraft = {
  title: "Untitled item",
  path: "",
  url: "",
  excerpt: "",
  body: "",
  visibility: "private",
  icon: "",
  tags: "",
  pinned: false,
  sortOrder: "",
};

const presetDrafts = [
  {
    id: "page",
    label: "Page",
    icon: FileTextIcon,
    draft: {
      ...emptyDraft,
      title: "Untitled page",
      path: "/about",
      body: "# Untitled page\n\nStart writing here.",
      visibility: "private" as const,
      icon: "website" as const,
    },
  },
  {
    id: "post",
    label: "Post",
    icon: FileTextIcon,
    draft: {
      ...emptyDraft,
      title: "Untitled post",
      path: "/posts/untitled-post",
      excerpt: "A short summary for the post list.",
      body: "# Untitled post\n\nStart writing here.",
      visibility: "private" as const,
      icon: "note" as const,
    },
  },
  {
    id: "link",
    label: "Link",
    icon: LinkIcon,
    draft: {
      ...emptyDraft,
      title: "Useful link",
      url: "https://example.com/",
      visibility: "public" as const,
      icon: "link" as const,
    },
  },
  {
    id: "bookmark",
    label: "Bookmark",
    icon: BookmarkIcon,
    draft: {
      ...emptyDraft,
      title: "Private bookmark",
      url: "https://example.com/",
      visibility: "private" as const,
      icon: "book" as const,
    },
  },
  {
    id: "social",
    label: "Social",
    icon: GlobeIcon,
    draft: {
      ...emptyDraft,
      title: "Social link",
      url: "https://example.com/",
      visibility: "public" as const,
      icon: "linkedin" as const,
      pinned: true,
      sortOrder: "5",
    },
  },
] as const;

function draftFromItem(item: GraphleSiteItem): ItemDraft {
  return {
    title: item.title,
    path: item.path ?? "",
    url: item.url ?? "",
    excerpt: item.excerpt ?? "",
    body: item.body ?? "",
    visibility: item.visibility,
    icon: item.icon ?? "",
    tags: item.tags.map((tag) => tag.key).join(", "),
    pinned: item.pinned,
    sortOrder: item.sortOrder === undefined ? "" : String(item.sortOrder),
  };
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function inputFromDraft(draft: ItemDraft): GraphleSiteItemInput {
  const sortOrder = optionalTrimmed(draft.sortOrder);
  const parsedSortOrder = sortOrder === undefined ? undefined : Number(sortOrder);
  if (parsedSortOrder !== undefined && !Number.isFinite(parsedSortOrder)) {
    throw new Error("Sort order must be a finite number.");
  }

  return {
    title: draft.title,
    path: optionalTrimmed(draft.path),
    url: optionalTrimmed(draft.url),
    excerpt: optionalTrimmed(draft.excerpt),
    body: optionalTrimmed(draft.body),
    visibility: draft.visibility,
    icon: draft.icon || undefined,
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    pinned: draft.pinned,
    sortOrder: parsedSortOrder,
  };
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function VisibilityBadge({ visibility }: { readonly visibility: GraphleSiteVisibility }) {
  return (
    <Badge variant={visibility === "public" ? "default" : "outline"}>
      {visibility === "public" ? "public" : "private"}
    </Badge>
  );
}

function ItemMarkers({ item }: { readonly item: GraphleSiteItem }) {
  return (
    <span className="graphle-site-item-markers">
      <VisibilityBadge visibility={item.visibility} />
      {item.pinned ? (
        <Badge variant="outline">
          <PinIcon aria-hidden={true} />
          pinned
        </Badge>
      ) : null}
    </span>
  );
}

function RoutePreview({ snapshot }: { readonly snapshot: GraphleSiteStatusSnapshot }) {
  const route = snapshot.route;

  if (route.kind === "item") {
    const item = route.item;
    return (
      <article className="graphle-site-preview-article" data-route-kind="item">
        <div className="graphle-site-preview-meta">
          <ItemMarkers item={item} />
          {item.path ? <span>{item.path}</span> : null}
          {item.publishedAt ? <time>{item.publishedAt.slice(0, 10)}</time> : null}
        </div>
        <h2>{item.title}</h2>
        {item.excerpt ? <p className="graphle-site-excerpt">{item.excerpt}</p> : null}
        {item.url ? (
          <a className="graphle-site-outbound" href={item.url} rel="noreferrer">
            <ExternalLinkIcon aria-hidden={true} />
            {item.url}
          </a>
        ) : null}
        {item.tags.length ? (
          <div className="graphle-site-tags">
            {item.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
        {item.body ? (
          <MarkdownRenderer className="graphle-site-markdown" content={item.body} />
        ) : null}
      </article>
    );
  }

  return (
    <article className="graphle-site-preview-article" data-route-kind="not-found">
      <div className="graphle-site-preview-meta">
        <Badge variant="outline">404</Badge>
        <span>{route.path}</span>
      </div>
      <h2>Page not found</h2>
      <p className="graphle-site-excerpt">{route.message}</p>
    </article>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="graphle-site-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function VisibilitySelect({
  value,
  onChange,
}: {
  readonly value: GraphleSiteVisibility;
  readonly onChange: (value: GraphleSiteVisibility) => void;
}) {
  return (
    <select
      className="graphle-site-select"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value === "public" ? "public" : "private")}
    >
      <option value="private">Private</option>
      <option value="public">Public</option>
    </select>
  );
}

function IconSelect({
  value,
  onChange,
}: {
  readonly value: "" | GraphleSiteIconPreset;
  readonly onChange: (value: "" | GraphleSiteIconPreset) => void;
}) {
  return (
    <select
      className="graphle-site-select"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value as "" | GraphleSiteIconPreset)}
    >
      <option value="">None</option>
      {siteIconPresets.map((preset) => (
        <option key={preset} value={preset}>
          {preset}
        </option>
      ))}
    </select>
  );
}

function SaveError({ state }: { readonly state: SaveState }) {
  if (state.kind !== "error") return null;
  return <p className="graphle-site-save-error">{state.message}</p>;
}

function ItemEditor({
  item,
  initialDraft,
  onCreate,
  onUpdate,
}: {
  readonly item?: GraphleSiteItem;
  readonly initialDraft: ItemDraft;
  readonly onCreate?: (input: GraphleSiteItemInput) => Promise<void>;
  readonly onUpdate?: (id: string, input: GraphleSiteItemInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ItemDraft>(() => (item ? draftFromItem(item) : initialDraft));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    setDraft(item ? draftFromItem(item) : initialDraft);
    setSaveState({ kind: "idle" });
  }, [initialDraft, item]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ kind: "saving" });
    try {
      const input = inputFromDraft(draft);
      if (item) {
        await onUpdate?.(item.id, input);
      } else {
        await onCreate?.(input);
      }
    } catch (error) {
      setSaveState({ kind: "error", message: messageForError(error) });
    }
  }

  return (
    <form className="graphle-site-editor" onSubmit={submit}>
      <div className="graphle-site-editor-heading">
        <h3>{item ? "Edit item" : "Create item"}</h3>
        <VisibilityBadge visibility={draft.visibility} />
      </div>
      <Field label="Title">
        <Input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />
      </Field>
      <div className="graphle-site-field-row">
        <Field label="Path">
          <Input
            value={draft.path}
            placeholder="/about"
            onChange={(event) => setDraft((current) => ({ ...current, path: event.target.value }))}
          />
        </Field>
        <Field label="Visibility">
          <VisibilitySelect
            value={draft.visibility}
            onChange={(visibility) => setDraft((current) => ({ ...current, visibility }))}
          />
        </Field>
      </div>
      <Field label="URL">
        <Input
          value={draft.url}
          placeholder="https://example.com"
          onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
        />
      </Field>
      <div className="graphle-site-field-row">
        <Field label="Icon">
          <IconSelect
            value={draft.icon}
            onChange={(icon) => setDraft((current) => ({ ...current, icon }))}
          />
        </Field>
        <Field label="Sort order">
          <Input
            type="number"
            value={draft.sortOrder}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sortOrder: event.target.value }))
            }
          />
        </Field>
      </div>
      <Field label="Tags">
        <Input
          value={draft.tags}
          placeholder="graphle, notes"
          onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
        />
      </Field>
      <label className="graphle-site-checkbox">
        <input
          type="checkbox"
          checked={draft.pinned}
          onChange={(event) =>
            setDraft((current) => ({ ...current, pinned: event.target.checked }))
          }
        />
        <span>Pinned</span>
      </label>
      <Field label="Excerpt">
        <Textarea
          rows={3}
          value={draft.excerpt}
          onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))}
        />
      </Field>
      <Field label="Body">
        <Textarea
          rows={12}
          value={draft.body}
          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
        />
      </Field>
      <div className="graphle-site-markdown-preview" aria-label="Markdown preview">
        <MarkdownRenderer
          className="graphle-site-markdown"
          content={draft.body || draft.excerpt || "Nothing to preview yet."}
        />
      </div>
      <div className="graphle-site-editor-actions">
        <Button type="submit" disabled={saveState.kind === "saving"}>
          {item ? (
            <SaveIcon aria-hidden={true} data-icon="inline-start" />
          ) : (
            <PlusIcon aria-hidden={true} data-icon="inline-start" />
          )}
          {item ? "Save item" : "Create item"}
        </Button>
      </div>
      <SaveError state={saveState} />
    </form>
  );
}

function ItemSidebar({
  items,
  authenticated,
  onEdit,
}: {
  readonly items: readonly GraphleSiteItem[];
  readonly authenticated: boolean;
  readonly onEdit: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => [...items].filter((item) => siteItemMatchesSearch(item, query)).sort(compareSiteItems),
    [items, query],
  );

  return (
    <aside className="graphle-site-sidebar" aria-label="Site items">
      <label className="graphle-site-search">
        <SearchIcon aria-hidden={true} />
        <Input
          value={query}
          placeholder="Search items"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul>
        {filtered.map((item) => {
          const href = item.path ?? item.url ?? "#";
          const external = !item.path && Boolean(item.url);
          return (
            <li key={item.id}>
              <a href={href} rel={external ? "noreferrer" : undefined}>
                <span>{item.title}</span>
                <small>{item.path ?? item.url ?? "unrouted"}</small>
              </a>
              <ItemMarkers item={item} />
              {item.tags.length ? (
                <span className="graphle-site-sidebar-tags">
                  {item.tags.map((tag) => tag.name).join(", ")}
                </span>
              ) : null}
              {authenticated ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item.id)}>
                  <Edit3Icon aria-hidden={true} data-icon="inline-start" />
                  Edit
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function PresetButtons({ onCreate }: { readonly onCreate: (draft: ItemDraft) => void }) {
  return (
    <div className="graphle-site-presets" aria-label="Creation presets">
      {presetDrafts.map((preset) => {
        const Icon = preset.icon;
        return (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCreate(preset.draft)}
          >
            <Icon aria-hidden={true} data-icon="inline-start" />
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}

function InlineAuthoring({
  snapshot,
  mode,
  selectedItem,
  onCreateMode,
  onEditMode,
  onCreateItem,
  onUpdateItem,
}: {
  readonly snapshot: GraphleSiteStatusSnapshot;
  readonly mode: EditorMode;
  readonly selectedItem?: GraphleSiteItem;
  readonly onCreateMode: (draft: ItemDraft) => void;
  readonly onEditMode: (id: string) => void;
  readonly onCreateItem?: (input: GraphleSiteItemInput) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<void>;
}) {
  if (!snapshot.session.authenticated) return null;

  return (
    <aside className="graphle-site-authoring" aria-label="Inline authoring">
      <div className="graphle-site-create-form">
        <h4>New item</h4>
        <PresetButtons onCreate={onCreateMode} />
      </div>
      <ItemEditor
        item={mode.kind === "edit" ? selectedItem : undefined}
        initialDraft={mode.kind === "create" ? mode.draft : emptyDraft}
        onCreate={onCreateItem}
        onUpdate={onUpdateItem}
      />
      <div className="graphle-site-content-lists">
        <section>
          <h4>Editable items</h4>
          <ul>
            {snapshot.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onEditMode(item.id)}>
                  {item.visibility === "private" ? <LockIcon aria-hidden={true} /> : null}
                  <span>{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

function initialCreateDraft(snapshot: GraphleSiteStatusSnapshot): ItemDraft {
  if (snapshot.route.kind === "not-found") {
    return {
      ...presetDrafts[0].draft,
      path: snapshot.route.path,
    };
  }
  return presetDrafts[0].draft;
}

function ReadySitePreview({
  snapshot,
  onCreateItem,
  onUpdateItem,
}: {
  readonly snapshot: GraphleSiteStatusSnapshot;
  readonly onCreateItem?: (input: GraphleSiteItemInput) => Promise<void>;
  readonly onUpdateItem?: (id: string, input: GraphleSiteItemInput) => Promise<void>;
}) {
  const routeItemId = snapshot.route.kind === "item" ? snapshot.route.item.id : undefined;
  const [mode, setMode] = useState<EditorMode>(() =>
    routeItemId
      ? { kind: "edit", id: routeItemId }
      : { kind: "create", draft: initialCreateDraft(snapshot) },
  );

  useEffect(() => {
    setMode(
      routeItemId
        ? { kind: "edit", id: routeItemId }
        : { kind: "create", draft: initialCreateDraft(snapshot) },
    );
  }, [routeItemId, snapshot]);

  const selectedItem =
    mode.kind === "edit" ? snapshot.items.find((item) => item.id === mode.id) : undefined;

  return (
    <div className="graphle-site-workspace">
      <section className="graphle-site-preview" aria-label="Website preview">
        <RoutePreview snapshot={snapshot} />
      </section>
      <ItemSidebar
        items={snapshot.items}
        authenticated={snapshot.session.authenticated}
        onEdit={(id) => setMode({ kind: "edit", id })}
      />
      <InlineAuthoring
        snapshot={snapshot}
        mode={mode}
        selectedItem={selectedItem}
        onCreateMode={(draft) => setMode({ kind: "create", draft })}
        onEditMode={(id) => setMode({ kind: "edit", id })}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
      />
    </div>
  );
}

function GraphleSitePreview({ status, onCreateItem, onUpdateItem }: GraphleSiteFeatureOptions) {
  if (status.state === "loading") {
    return <GraphleShellLoadingState label="Loading site preview" />;
  }

  if (status.state === "error") {
    return <GraphleShellErrorState description={status.message} title="Site preview unavailable" />;
  }

  return (
    <ReadySitePreview
      snapshot={status.snapshot}
      onCreateItem={onCreateItem}
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
    navigation: [
      {
        id: "site.preview.nav",
        label: "Site",
        href: "/",
        order: 10,
      },
    ],
    commands: options.onRefresh
      ? [
          {
            id: "site.refresh-status",
            label: "Refresh",
            icon: RefreshCwIcon,
            order: 10,
            run: options.onRefresh,
          },
        ]
      : [],
    pages: [
      {
        id: "site.preview",
        label: "Site preview",
        path: activePagePath(options.status),
        order: 10,
        render: () => <GraphleSitePreview {...options} />,
      },
    ],
  };
}
