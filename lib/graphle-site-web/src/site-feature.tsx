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
  siteItemSurface,
  siteItemViewSurface,
  type SiteIconPreset,
} from "@dpeek/graphle-module-site";
import { useGraphSyncState } from "@dpeek/graphle-react";
import { buildLiveEntitySurfacePlan, type AnyEntitySurfaceEntityRef } from "@dpeek/graphle-surface";
import {
  buildEntitySurfaceFieldSections,
  EntitySurface,
  EntitySurfaceFieldSections,
} from "@dpeek/graphle-surface/react-dom";
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
import { Input } from "@dpeek/graphle-web-ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@dpeek/graphle-web-ui/sidebar";
import { TextTooltip, TooltipProvider } from "@dpeek/graphle-web-ui/tooltip";
import type { GraphleShellFeature } from "@dpeek/graphle-web-shell";
import {
  AtSignIcon,
  BookOpenIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GithubIcon,
  GlobeIcon,
  LinkIcon,
  LinkedinIcon,
  MailIcon,
  MoonIcon,
  PlusIcon,
  RssIcon,
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
  type MouseEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import type { GraphleSiteGraphClient, GraphleSiteReadonlyRuntime } from "./graph.js";
import {
  findGraphleSiteItemRef,
  listGraphleSiteItemViews,
  resolveGraphleSiteRoute,
  type GraphleSiteRoute,
  type GraphleSiteItemOrder,
  type GraphleSiteItemRef,
  type GraphleSiteItemView,
} from "./site-items.js";
import type { GraphleSiteDeployStatus, GraphleSiteStatusSnapshot } from "./status.js";
import { useGraphleSiteTheme } from "./theme.js";

export type GraphleSiteStatusState =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly snapshot: GraphleSiteStatusSnapshot }
  | { readonly state: "error"; readonly message: string };

export interface GraphleSiteFeatureOptions {
  readonly path?: string;
  readonly runtime?: GraphleSiteReadonlyRuntime | null;
  readonly status: GraphleSiteStatusState;
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItemView>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onRefresh?: () => void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrder[]) => Promise<void>;
  readonly onDeployCloudflare?: (input: GraphleCloudflareDeployRequest) => Promise<void>;
}

export interface GraphleCloudflareDeployRequest {
  readonly accountId?: string;
  readonly apiToken?: string;
  readonly workerName?: string;
}

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

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function iconForItem(item: GraphleSiteItemView): LucideIcon {
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

function RouteView({
  itemRef,
  route,
}: {
  readonly itemRef?: GraphleSiteItemRef;
  readonly route: GraphleSiteRoute;
}) {
  if (route.kind !== "item") {
    return (
      <article className="flex flex-col gap-4" data-route-kind="not-found">
        <h1>Page not found</h1>
        <p className="text-muted-foreground">{route.message}</p>
      </article>
    );
  }

  if (itemRef) return <GraphBackedItemView entity={itemRef} />;

  return (
    <article className="flex flex-col gap-4" data-route-kind="not-found">
      <h1>Page not found</h1>
      <p className="text-muted-foreground">No visible item exists at {route.path}.</p>
    </article>
  );
}

function GraphBackedItemView({ entity }: { readonly entity: GraphleSiteItemRef }) {
  const surfaceEntity = entity as unknown as AnyEntitySurfaceEntityRef;
  const surfacePlan = useMemo(
    () =>
      buildLiveEntitySurfacePlan(surfaceEntity, {
        mode: "view",
        surface: siteItemViewSurface,
      }),
    [surfaceEntity],
  );
  const sections = useMemo(() => buildEntitySurfaceFieldSections(surfacePlan), [surfacePlan]);

  return (
    <article className="flex flex-col gap-4" data-route-kind="item">
      <EntitySurfaceFieldSections chrome={false} mode="view" sections={sections} />
    </article>
  );
}

function ItemEditor({
  entity,
  runtime,
}: {
  readonly entity: GraphleSiteItemRef;
  readonly runtime: GraphleSiteGraphClient;
}) {
  return (
    <EntitySurface
      entity={entity as unknown as AnyEntitySurfaceEntityRef}
      mode="edit"
      mutationRuntime={runtime}
      sectionChrome={true}
      showModeToggle={false}
      surface={siteItemSurface}
    />
  );
}

function ItemEditorPage({
  entity,
  item,
  onDelete,
  runtime,
}: {
  readonly entity: GraphleSiteItemRef;
  readonly item: GraphleSiteItemView;
  readonly onDelete: () => void;
  readonly runtime: GraphleSiteGraphClient;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          aria-label={`Delete ${item.title}`}
          onClick={onDelete}
          size="sm"
          type="button"
          variant="destructive"
        >
          <Trash2Icon aria-hidden={true} data-icon="inline-start" />
          Delete
        </Button>
      </div>
      <ItemEditor entity={entity} runtime={runtime} />
    </div>
  );
}

function selectedContentItem({
  editItemId,
  items,
  route,
}: {
  readonly editItemId: string | null;
  readonly items: readonly GraphleSiteItemView[];
  readonly route: GraphleSiteRoute;
}): GraphleSiteItemView | undefined {
  if (editItemId) return items.find((item) => item.id === editItemId);
  return route.kind === "item" ? items.find((item) => item.id === route.itemId) : undefined;
}

export function buildGraphleSiteOrderPayload(
  items: readonly GraphleSiteItemView[],
): readonly GraphleSiteItemOrder[] {
  return items.map((item, index) => ({
    id: item.id,
    sortOrder: index,
  }));
}

function SortableItemRow({
  active,
  authenticated,
  item,
  onNavigate,
}: {
  readonly active: boolean;
  readonly authenticated: boolean;
  readonly item: GraphleSiteItemView;
  readonly onNavigate: (item: GraphleSiteItemView, event: MouseEvent<HTMLAnchorElement>) => void;
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
  const external = !authenticated && !item.path && Boolean(item.url);
  const href = authenticated ? (item.path ?? "#") : (item.path ?? item.url ?? "#");

  return (
    <SidebarMenuItem
      className="min-w-0 data-[dragging=true]:opacity-70"
      data-dragging={isDragging ? "true" : undefined}
      ref={setNodeRef}
      style={style}
    >
      <SidebarMenuButton
        className="min-w-0"
        isActive={active}
        {...(authenticated ? attributes : {})}
        {...(authenticated ? listeners : {})}
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
    </SidebarMenuItem>
  );
}

function ItemSidebar({
  activeItemId,
  authenticated,
  items,
  onCreate,
  onNavigate,
  onReorder,
}: {
  readonly activeItemId?: string;
  readonly authenticated: boolean;
  readonly items: readonly GraphleSiteItemView[];
  readonly onCreate: () => void;
  readonly onNavigate: (item: GraphleSiteItemView, event: MouseEvent<HTMLAnchorElement>) => void;
  readonly onReorder?: (items: readonly GraphleSiteItemOrder[]) => Promise<void>;
}) {
  const sortedItems = useMemo(() => [...items].sort(compareSiteItems), [items]);
  const [orderedIds, setOrderedIds] = useState<readonly string[]>(() =>
    sortedItems.map((item) => item.id),
  );
  const [reorderError, setReorderError] = useState("");
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
    .filter((item): item is GraphleSiteItemView => Boolean(item));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = renderIds.indexOf(String(active.id));
    const newIndex = renderIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove([...renderIds], oldIndex, newIndex);
    setOrderedIds(nextIds);
    setReorderError("");
    const nextItems = nextIds
      .map((id) => sortedItems.find((item) => item.id === id))
      .filter((item): item is GraphleSiteItemView => Boolean(item));
    try {
      await onReorder?.(buildGraphleSiteOrderPayload(nextItems));
    } catch (error) {
      setReorderError(messageForError(error));
      setOrderedIds(sortedItems.map((item) => item.id));
    }
  }

  const menu = (
    <SidebarMenu>
      {sortedByLocalOrder.map((item) => (
        <SortableItemRow
          active={item.id === activeItemId}
          authenticated={authenticated}
          item={item}
          key={item.id}
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
        <SidebarGroup>
          <SidebarGroupContent>
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
            {reorderError ? (
              <p className="px-3 text-xs leading-5 text-destructive">{reorderError}</p>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>
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

function deployStateLabel(deploy: GraphleSiteDeployStatus | undefined): string {
  if (!deploy) return "Checking";
  if (deploy.state === "deploying") return "Deploying";
  if (deploy.state === "ready") return "Ready";
  if (deploy.state === "error") return "Error";
  return "Idle";
}

function baselineStatusLabel(deploy: GraphleSiteDeployStatus | undefined): string {
  if (!deploy?.currentBaseline) return "Baseline pending";
  return deploy.currentBaseline.matchesLastDeploy
    ? "Current baseline deployed"
    : "New baseline pending";
}

function DeployPanel({
  deploy,
  onDeploy,
}: {
  readonly deploy?: GraphleSiteDeployStatus;
  readonly onDeploy?: (input: GraphleCloudflareDeployRequest) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState(deploy?.credentials.accountId ?? "");
  const [workerName, setWorkerName] = useState(deploy?.credentials.workerName ?? "");
  const [apiToken, setApiToken] = useState("");
  const [formError, setFormError] = useState("");
  const deploying = deploy?.state === "deploying";
  const missing = new Set(deploy?.credentials.missing ?? []);
  const showAccountId = missing.has("accountId") || accountId.length > 0;
  const showToken = missing.has("apiToken") || !deploy?.credentials.hasApiToken;
  const showWorkerName = true;

  useEffect(() => {
    setAccountId(deploy?.credentials.accountId ?? "");
    setWorkerName(deploy?.credentials.workerName ?? "");
  }, [deploy?.credentials.accountId, deploy?.credentials.workerName]);

  async function submitDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    try {
      await onDeploy?.({
        ...(accountId.trim() ? { accountId: accountId.trim() } : {}),
        ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
        ...(workerName.trim() ? { workerName: workerName.trim() } : {}),
      });
      setApiToken("");
    } catch (error) {
      setFormError(messageForError(error));
    }
  }

  const deployErrorMessage = deploy?.error
    ? deploy.error.step
      ? `${deploy.error.message} (${deploy.error.step})`
      : deploy.error.message
    : formError;

  return (
    <form
      className="flex min-w-0 flex-col gap-2 border-t border-sidebar-border pt-3"
      onSubmit={(event) => {
        void submitDeploy(event);
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-sidebar-foreground">Cloudflare</span>
        <span className="shrink-0 text-[0.6875rem] text-sidebar-foreground/70">
          {deployStateLabel(deploy)}
        </span>
      </div>
      {deploy?.metadata?.workerUrl ? (
        <a
          className="inline-flex min-w-0 items-center gap-1 text-xs text-sidebar-foreground underline-offset-4 hover:underline"
          href={deploy.metadata.workerUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{deploy.metadata.workerUrl}</span>
          <ExternalLinkIcon aria-hidden={true} className="size-3 shrink-0" />
        </a>
      ) : null}
      <p className="m-0 text-[0.6875rem] leading-4 text-sidebar-foreground/70">
        {baselineStatusLabel(deploy)}
      </p>
      {showAccountId ? (
        <Input
          aria-label="Cloudflare account ID"
          autoComplete="off"
          disabled={deploying}
          onChange={(event) => setAccountId(event.currentTarget.value)}
          placeholder="Cloudflare account ID"
          value={accountId}
        />
      ) : null}
      {showToken ? (
        <Input
          aria-label="Cloudflare API token"
          autoComplete="off"
          disabled={deploying}
          onChange={(event) => setApiToken(event.currentTarget.value)}
          placeholder="Cloudflare API token"
          type="password"
          value={apiToken}
        />
      ) : null}
      {showWorkerName ? (
        <Input
          aria-label="Worker name"
          autoComplete="off"
          disabled={deploying}
          onChange={(event) => setWorkerName(event.currentTarget.value)}
          placeholder="Worker name"
          value={workerName}
        />
      ) : null}
      {deployErrorMessage ? (
        <p className="m-0 text-[0.6875rem] leading-4 text-destructive">{deployErrorMessage}</p>
      ) : null}
      <Button disabled={deploying || !onDeploy} size="sm" type="submit">
        <CloudUploadIcon aria-hidden={true} data-icon="inline-start" />
        {deploying ? "Deploying" : "Deploy"}
      </Button>
    </form>
  );
}

function DeleteConfirmDialog({
  item,
  onConfirm,
  onOpenChange,
}: {
  readonly item: GraphleSiteItemView | null;
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
  graphRuntime,
  items,
  onCreateBlankItem,
  onDeleteItem,
  onDeployCloudflare,
  onNavigatePath,
  onReorderItems,
  route,
  snapshot,
}: {
  readonly graphRuntime?: GraphleSiteReadonlyRuntime | null;
  readonly items: readonly GraphleSiteItemView[];
  readonly onCreateBlankItem?: () => Promise<GraphleSiteItemView>;
  readonly onDeleteItem?: (id: string) => Promise<void>;
  readonly onDeployCloudflare?: (input: GraphleCloudflareDeployRequest) => Promise<void>;
  readonly onNavigatePath?: (path: string) => Promise<void> | void;
  readonly onReorderItems?: (items: readonly GraphleSiteItemOrder[]) => Promise<void>;
  readonly route: GraphleSiteRoute;
  readonly snapshot: GraphleSiteStatusSnapshot;
}) {
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<GraphleSiteItemView | null>(null);
  const [actionError, setActionError] = useState("");
  const activeItem = selectedContentItem({ editItemId, items, route });
  const mutationRuntime = graphRuntime && "sync" in graphRuntime ? graphRuntime : null;
  const routeItemId = route.kind === "item" ? route.itemId : undefined;
  const activeEditorItemId = editItemId ?? routeItemId;
  const activeItemRef =
    mutationRuntime && activeEditorItemId
      ? findGraphleSiteItemRef(mutationRuntime, activeEditorItemId)
      : undefined;
  const routeItemRef =
    graphRuntime && route.kind === "item"
      ? findGraphleSiteItemRef(graphRuntime, route.itemId)
      : undefined;

  function navigateToItem(item: GraphleSiteItemView, event: MouseEvent<HTMLAnchorElement>) {
    if (snapshot.session.authenticated) {
      event.preventDefault();
      setEditItemId(item.id);
      setActionError("");
      if (item.path && item.path !== route.path) {
        void onNavigatePath?.(item.path);
      }
      return;
    }

    if (!item.path) return;
    event.preventDefault();
    setEditItemId(null);
    void onNavigatePath?.(item.path);
  }

  async function createBlankItem() {
    setActionError("");
    try {
      const created = await onCreateBlankItem?.();
      if (!created) return;
      setEditItemId(created.id);
      if (created.path) await onNavigatePath?.(created.path);
    } catch (error) {
      setActionError(messageForError(error));
    }
  }

  async function confirmDelete() {
    const item = deleteItem;
    if (!item) return;
    setDeleteItem(null);
    setActionError("");
    try {
      await onDeleteItem?.(item.id);
      if (editItemId === item.id || routeItemId === item.id) {
        setEditItemId(null);
        await onNavigatePath?.("/");
      }
    } catch (error) {
      setActionError(messageForError(error));
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
        <Sidebar collapsible="none" variant="sidebar">
          <ItemSidebar
            activeItemId={activeEditorItemId}
            authenticated={snapshot.session.authenticated}
            items={items}
            onCreate={() => {
              void createBlankItem();
            }}
            onNavigate={navigateToItem}
            onReorder={onReorderItems}
          />
          <SidebarFooter>
            {snapshot.session.authenticated ? (
              <DeployPanel deploy={snapshot.deploy} onDeploy={onDeployCloudflare} />
            ) : null}
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <main className="mx-auto block min-h-0 w-full max-w-[52rem] px-5 py-8 md:min-h-svh md:px-[clamp(1.25rem,4vw,3.5rem)] md:py-[clamp(2rem,6vw,5rem)]">
            {actionError ? (
              <p className="mb-4 max-w-[46rem] rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            ) : null}
            {snapshot.session.authenticated && activeItem && activeItemRef && mutationRuntime ? (
              <ItemEditorPage
                entity={activeItemRef}
                item={activeItem}
                onDelete={() => setDeleteItem(activeItem)}
                runtime={mutationRuntime}
              />
            ) : (
              <RouteView itemRef={routeItemRef} route={route} />
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

function GraphBackedReadySitePreview({
  path,
  runtime,
  snapshot,
  ...props
}: Omit<Parameters<typeof ReadySitePreview>[0], "graphRuntime" | "items" | "route"> & {
  readonly path: string;
  readonly runtime: GraphleSiteGraphClient;
}) {
  const syncState = useGraphSyncState(runtime);
  const selection = useMemo(
    () => ({
      items: listGraphleSiteItemViews(runtime, { includePrivate: true }),
      route: resolveGraphleSiteRoute(runtime, path, { includePrivate: true }),
    }),
    [path, runtime, syncState],
  );

  return (
    <ReadySitePreview
      {...props}
      graphRuntime={runtime}
      items={selection.items}
      route={selection.route}
      snapshot={snapshot}
    />
  );
}

function ReadonlyGraphBackedReadySitePreview({
  path,
  runtime,
  snapshot,
  ...props
}: Omit<Parameters<typeof ReadySitePreview>[0], "graphRuntime" | "items" | "route"> & {
  readonly path: string;
  readonly runtime: GraphleSiteReadonlyRuntime;
}) {
  const selection = useMemo(
    () => ({
      items: listGraphleSiteItemViews(runtime),
      route: resolveGraphleSiteRoute(runtime, path),
    }),
    [path, runtime],
  );

  return (
    <ReadySitePreview
      {...props}
      graphRuntime={runtime}
      items={selection.items}
      route={selection.route}
      snapshot={snapshot}
    />
  );
}

export function GraphleSitePreview({
  path,
  runtime,
  status,
  onCreateBlankItem,
  onDeleteItem,
  onDeployCloudflare,
  onNavigatePath,
  onReorderItems,
}: GraphleSiteFeatureOptions) {
  if (status.state === "loading") return <LoadingSurface />;
  if (status.state === "error") return <ErrorSurface message={status.message} />;

  const routePath = path ?? status.snapshot.path;
  if (status.snapshot.session.authenticated) {
    if (!runtime || !("sync" in runtime)) {
      return <ErrorSurface message="The private site graph is unavailable." />;
    }

    return (
      <GraphBackedReadySitePreview
        path={routePath}
        runtime={runtime}
        snapshot={status.snapshot}
        onCreateBlankItem={onCreateBlankItem}
        onDeleteItem={onDeleteItem}
        onDeployCloudflare={onDeployCloudflare}
        onNavigatePath={onNavigatePath}
        onReorderItems={onReorderItems}
      />
    );
  }

  if (runtime) {
    return (
      <ReadonlyGraphBackedReadySitePreview
        path={routePath}
        runtime={runtime}
        snapshot={status.snapshot}
        onCreateBlankItem={onCreateBlankItem}
        onDeleteItem={onDeleteItem}
        onDeployCloudflare={onDeployCloudflare}
        onNavigatePath={onNavigatePath}
        onReorderItems={onReorderItems}
      />
    );
  }

  return <ErrorSurface message="The public site graph is unavailable." />;
}

function activePagePath(status: GraphleSiteStatusState): string {
  return status.state === "ready" ? status.snapshot.path : "/";
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
