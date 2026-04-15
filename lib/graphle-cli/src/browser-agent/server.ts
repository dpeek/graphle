import type { ValidationResult, Workflow } from "../agent/types.js";
import { loadWorkflowFile } from "../agent/workflow.js";
import {
  browserAgentActiveSessionPath,
  browserAgentHealthPath,
  browserAgentLaunchPath,
  browserAgentSessionEventsPath,
  codexSessionLaunchFailureCodes,
  type BrowserAgentActiveSessionLookupRequest,
  type BrowserAgentActiveSessionLookupResult,
  type BrowserAgentHealthResponse,
  type BrowserAgentSessionEventMessage,
  type BrowserAgentSessionEventStreamRequest,
  type CodexSessionLaunchFailure,
  type CodexSessionLaunchRequest,
  type CodexSessionLaunchResult,
} from "./transport.js";

export interface BrowserAgentCliOptions {
  readonly host?: string;
  readonly port?: number;
  readonly workflowPath?: string;
}

export interface BrowserAgentLaunchCoordinator {
  launchSession(request: CodexSessionLaunchRequest): Promise<CodexSessionLaunchResult>;
  lookupActiveSession(
    request: BrowserAgentActiveSessionLookupRequest,
  ): Promise<BrowserAgentActiveSessionLookupResult>;
  observeSessionEvents(
    request: BrowserAgentSessionEventStreamRequest,
    observer: (message: BrowserAgentSessionEventMessage) => void,
    signal: AbortSignal,
  ): Promise<void>;
}

export interface BrowserAgentRuntimeContext {
  readonly startedAt: string;
  readonly status: "ready" | "unavailable";
  readonly statusMessage: string;
  readonly workflow?: Workflow;
}

export interface BrowserAgentServerDependencies {
  readonly coordinator?: BrowserAgentLaunchCoordinator;
  readonly loadWorkflow?: typeof loadWorkflowFile;
  readonly now?: () => Date;
  readonly serve?: typeof Bun.serve;
  readonly stdout?: Pick<typeof console, "log" | "error">;
}

export interface BrowserAgentServer {
  readonly context: BrowserAgentRuntimeContext;
  fetch(request: Request): Promise<Response> | Response;
}

function printHelp() {
  console.log(`Usage:
  graphle browser-agent [entrypointPath] [--host <host>] [--port <port>]

Defaults:
  entrypointPath: ./graphle.ts + ./graphle.md
  host: 127.0.0.1
  port: 4317
  `);
}

function errorResponse(message: string, status: number, code?: string): Response {
  return Response.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

function streamingHeaders() {
  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/x-ndjson",
  };
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return parsed;
}

export function parseBrowserAgentCliArgs(args: string[]): BrowserAgentCliOptions & {
  readonly help: boolean;
} {
  const options: { help: boolean; host?: string; port?: number; workflowPath?: string } = {
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--host") {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --host");
      }
      options.host = next;
      index += 1;
      continue;
    }
    if (value === "--port") {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --port");
      }
      options.port = parsePort(next);
      index += 1;
      continue;
    }
    if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    }
    if (!options.workflowPath) {
      options.workflowPath = value;
      continue;
    }
    throw new Error(
      "Usage: graphle browser-agent [entrypointPath] [--host <host>] [--port <port>]",
    );
  }

  return options;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function parseLaunchSubject(value: unknown, label: string): CodexSessionLaunchRequest["subject"] {
  if (!isObjectRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const kind = requireString(value.kind, `${label}.kind`);
  if (kind === "branch") {
    return {
      kind,
      branchId: requireString(value.branchId, `${label}.branchId`),
    };
  }
  if (kind === "commit") {
    return {
      kind,
      branchId: requireString(value.branchId, `${label}.branchId`),
      commitId: requireString(value.commitId, `${label}.commitId`),
    };
  }
  throw new Error(`${label}.kind must be "branch" or "commit".`);
}

function parseActor(value: unknown, label: string): CodexSessionLaunchRequest["actor"] {
  if (!isObjectRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const surface = requireString(value.surface, `${label}.surface`);
  if (surface !== "browser" && surface !== "tui") {
    throw new Error(`${label}.surface must be "browser" or "tui".`);
  }
  return {
    principalId: requireString(value.principalId, `${label}.principalId`),
    sessionId: requireString(value.sessionId, `${label}.sessionId`),
    surface,
  };
}

function parseWorkflowLaunchContextRecord(
  value: unknown,
  label: string,
): {
  readonly context: string;
  readonly references: string;
} {
  if (!isObjectRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return {
    context: requireString(value.context, `${label}.context`),
    references: requireString(value.references, `${label}.references`),
  };
}

function parseWorkflowLaunchPayload(
  value: unknown,
): NonNullable<CodexSessionLaunchRequest["workflow"]> {
  if (!isObjectRecord(value)) {
    throw new Error('Launch request "workflow" must be an object.');
  }
  if (!isObjectRecord(value.selection)) {
    throw new Error('Launch request "workflow.selection" must be an object.');
  }
  if (!isObjectRecord(value.context)) {
    throw new Error('Launch request "workflow.context" must be an object.');
  }

  const strategy = requireString(
    value.selection.strategy,
    'Launch request "workflow.selection.strategy"',
  );
  if (strategy !== "selected-commit-next-runnable") {
    throw new Error(
      'Launch request "workflow.selection.strategy" must be "selected-commit-next-runnable".',
    );
  }

  const source = requireString(
    value.selection.source,
    'Launch request "workflow.selection.source"',
  );
  if (
    source !== "active-commit" &&
    source !== "planned-commit" &&
    source !== "ready-commit" &&
    source !== "retained-open-session"
  ) {
    throw new Error(
      'Launch request "workflow.selection.source" must be "active-commit", "planned-commit", "ready-commit", or "retained-open-session".',
    );
  }

  const workflowSessionKind = requireString(
    value.selection.workflowSessionKind,
    'Launch request "workflow.selection.workflowSessionKind"',
  );
  if (
    workflowSessionKind !== "Plan" &&
    workflowSessionKind !== "Review" &&
    workflowSessionKind !== "Implement"
  ) {
    throw new Error(
      'Launch request "workflow.selection.workflowSessionKind" must be "Plan", "Review", or "Implement".',
    );
  }

  const context = value.context;
  const sessionContext = parseWorkflowLaunchContextRecord(
    isObjectRecord(context.session) ? context.session : context.session,
    'Launch request "workflow.context.session"',
  );
  const sessionKind = requireString(
    isObjectRecord(context.session) ? context.session.kind : undefined,
    'Launch request "workflow.context.session.kind"',
  );
  if (sessionKind !== "Plan" && sessionKind !== "Review" && sessionKind !== "Implement") {
    throw new Error(
      'Launch request "workflow.context.session.kind" must be "Plan", "Review", or "Implement".',
    );
  }
  if (sessionKind !== workflowSessionKind) {
    throw new Error(
      'Launch request "workflow.context.session.kind" must match "workflow.selection.workflowSessionKind".',
    );
  }

  const local =
    value.local === undefined
      ? undefined
      : (() => {
          if (!isObjectRecord(value.local)) {
            throw new Error('Launch request "workflow.local" must be an object.');
          }
          return {
            ...(typeof value.local.repositoryRoot === "string"
              ? {
                  repositoryRoot: requireString(
                    value.local.repositoryRoot,
                    'Launch request "workflow.local.repositoryRoot"',
                  ),
                }
              : {}),
            ...(typeof value.local.worktreePath === "string"
              ? {
                  worktreePath: requireString(
                    value.local.worktreePath,
                    'Launch request "workflow.local.worktreePath"',
                  ),
                }
              : {}),
            ...(typeof value.local.gitBranchName === "string"
              ? {
                  gitBranchName: requireString(
                    value.local.gitBranchName,
                    'Launch request "workflow.local.gitBranchName"',
                  ),
                }
              : {}),
            ...(typeof value.local.headSha === "string"
              ? {
                  headSha: requireString(
                    value.local.headSha,
                    'Launch request "workflow.local.headSha"',
                  ),
                }
              : {}),
          };
        })();

  return {
    context: {
      branch: {
        ...parseWorkflowLaunchContextRecord(
          context.branch,
          'Launch request "workflow.context.branch"',
        ),
        name: requireString(
          isObjectRecord(context.branch) ? context.branch.name : undefined,
          'Launch request "workflow.context.branch.name"',
        ),
        slug: requireString(
          isObjectRecord(context.branch) ? context.branch.slug : undefined,
          'Launch request "workflow.context.branch.slug"',
        ),
      },
      commit: {
        ...parseWorkflowLaunchContextRecord(
          context.commit,
          'Launch request "workflow.context.commit"',
        ),
        name: requireString(
          isObjectRecord(context.commit) ? context.commit.name : undefined,
          'Launch request "workflow.context.commit.name"',
        ),
        slug: requireString(
          isObjectRecord(context.commit) ? context.commit.slug : undefined,
          'Launch request "workflow.context.commit.slug"',
        ),
      },
      session: {
        ...sessionContext,
        kind: sessionKind,
        name: requireString(
          isObjectRecord(context.session) ? context.session.name : undefined,
          'Launch request "workflow.context.session.name"',
        ),
      },
    },
    ...(local && Object.keys(local).length > 0 ? { local } : {}),
    selection: {
      source,
      strategy,
      workflowSessionKind,
    },
  };
}

function validateWorkflowLaunchKind(
  launchKind: CodexSessionLaunchRequest["kind"],
  workflowSessionKind: NonNullable<
    CodexSessionLaunchRequest["workflow"]
  >["selection"]["workflowSessionKind"],
  label: string,
) {
  const expectedLaunchKind =
    workflowSessionKind === "Plan"
      ? "planning"
      : workflowSessionKind === "Review"
        ? "review"
        : "execution";
  if (launchKind !== expectedLaunchKind) {
    throw new Error(`${label} must match "workflow.selection.workflowSessionKind".`);
  }
}

function parseLaunchRequest(value: unknown): CodexSessionLaunchRequest {
  if (!isObjectRecord(value)) {
    throw new Error("Launch request must be a JSON object.");
  }
  const kind = requireString(value.kind, 'Launch request "kind"');
  if (kind !== "planning" && kind !== "execution" && kind !== "review") {
    throw new Error('Launch request "kind" must be "planning", "execution", or "review".');
  }
  const request: {
    actor: CodexSessionLaunchRequest["actor"];
    delegation?: CodexSessionLaunchRequest["delegation"];
    kind: CodexSessionLaunchRequest["kind"];
    preference?: CodexSessionLaunchRequest["preference"];
    projectId: string;
    selection?: CodexSessionLaunchRequest["selection"];
    subject: CodexSessionLaunchRequest["subject"];
    workflow?: CodexSessionLaunchRequest["workflow"];
  } = {
    actor: parseActor(value.actor, 'Launch request "actor"'),
    kind,
    projectId: requireString(value.projectId, 'Launch request "projectId"'),
    subject: parseLaunchSubject(value.subject, 'Launch request "subject"'),
  };

  if (value.preference !== undefined) {
    if (!isObjectRecord(value.preference)) {
      throw new Error('Launch request "preference" must be an object.');
    }
    const mode = requireString(value.preference.mode, 'Launch request "preference.mode"');
    if (mode !== "launch-new" && mode !== "attach-or-launch" && mode !== "attach-existing") {
      throw new Error(
        'Launch request "preference.mode" must be "launch-new", "attach-or-launch", or "attach-existing".',
      );
    }
    request.preference = { mode };
  }

  if (value.selection !== undefined) {
    if (!isObjectRecord(value.selection)) {
      throw new Error('Launch request "selection" must be an object.');
    }
    request.selection = {
      ...(typeof value.selection.projectId === "string"
        ? { projectId: value.selection.projectId }
        : {}),
      ...(typeof value.selection.branchId === "string"
        ? { branchId: value.selection.branchId }
        : {}),
      ...(typeof value.selection.commitId === "string"
        ? { commitId: value.selection.commitId }
        : {}),
    };
  }

  if (value.delegation !== undefined) {
    if (!isObjectRecord(value.delegation) || !isObjectRecord(value.delegation.lease)) {
      throw new Error('Launch request "delegation.lease" must be an object when provided.');
    }
    request.delegation = {
      lease: value.delegation.lease as unknown as NonNullable<
        CodexSessionLaunchRequest["delegation"]
      >["lease"],
    };
  }

  if (value.workflow !== undefined) {
    request.workflow = parseWorkflowLaunchPayload(value.workflow);
    if (request.subject.kind !== "commit") {
      throw new Error('Launch request "workflow" requires a commit-scoped subject.');
    }
    validateWorkflowLaunchKind(
      request.kind,
      request.workflow.selection.workflowSessionKind,
      'Launch request "kind"',
    );
  }

  return request;
}

function parseActiveSessionLookupRequest(value: unknown): BrowserAgentActiveSessionLookupRequest {
  if (!isObjectRecord(value)) {
    throw new Error("Active-session lookup request must be a JSON object.");
  }
  const kind = requireString(value.kind, 'Active-session lookup request "kind"');
  if (kind !== "planning" && kind !== "execution" && kind !== "review") {
    throw new Error(
      'Active-session lookup request "kind" must be "planning", "execution", or "review".',
    );
  }

  return {
    actor: parseActor(value.actor, 'Active-session lookup request "actor"'),
    kind,
    projectId: requireString(value.projectId, 'Active-session lookup request "projectId"'),
    subject: parseLaunchSubject(value.subject, 'Active-session lookup request "subject"'),
    ...(value.workflow !== undefined
      ? {
          workflow: (() => {
            const workflow = parseWorkflowLaunchPayload(value.workflow);
            const subject = parseLaunchSubject(
              value.subject,
              'Active-session lookup request "subject"',
            );
            if (subject.kind !== "commit") {
              throw new Error(
                'Active-session lookup request "workflow" requires a commit-scoped subject.',
              );
            }
            validateWorkflowLaunchKind(
              kind,
              workflow.selection.workflowSessionKind,
              'Active-session lookup request "kind"',
            );
            return workflow;
          })(),
        }
      : {}),
  };
}

function parseAttachHandle(
  value: unknown,
  label: string,
): BrowserAgentSessionEventStreamRequest["attach"] {
  if (!isObjectRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const transport = requireString(value.transport, `${label}.transport`);
  if (transport !== "browser-agent-http") {
    throw new Error(`${label}.transport must be "browser-agent-http".`);
  }

  return {
    attachToken: requireString(value.attachToken, `${label}.attachToken`),
    browserAgentSessionId: requireString(
      value.browserAgentSessionId,
      `${label}.browserAgentSessionId`,
    ),
    expiresAt: requireString(value.expiresAt, `${label}.expiresAt`),
    transport,
  };
}

function parseSessionEventStreamRequest(value: unknown): BrowserAgentSessionEventStreamRequest {
  if (!isObjectRecord(value)) {
    throw new Error("Session event stream request must be a JSON object.");
  }

  return {
    attach: parseAttachHandle(value.attach, 'Session event stream request "attach"'),
    sessionId: requireString(value.sessionId, 'Session event stream request "sessionId"'),
  };
}

function createUnavailableLaunchFailure(message: string): CodexSessionLaunchFailure {
  return {
    code: "local-bridge-unavailable",
    message,
    ok: false,
    retryable: true,
    source: "browser-agent",
  };
}

function buildContext(
  workflowResult: ValidationResult<Workflow>,
  coordinator: BrowserAgentLaunchCoordinator | undefined,
  now: () => Date,
): BrowserAgentRuntimeContext {
  if (!workflowResult.ok) {
    return {
      startedAt: now().toISOString(),
      status: "unavailable",
      statusMessage: workflowResult.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join("; "),
    };
  }
  if (!coordinator) {
    return {
      startedAt: now().toISOString(),
      status: "unavailable",
      statusMessage:
        "No shared workflow launch coordinator is configured for the local browser-agent runtime.",
      workflow: workflowResult.value,
    };
  }
  return {
    startedAt: now().toISOString(),
    status: "ready",
    statusMessage: "Browser-agent runtime ready for launch, attach, and active-session lookup.",
    workflow: workflowResult.value,
  };
}

function isLaunchFailure(value: unknown): value is CodexSessionLaunchFailure {
  return (
    isObjectRecord(value) &&
    value.ok === false &&
    typeof value.code === "string" &&
    codexSessionLaunchFailureCodes.includes(value.code as CodexSessionLaunchFailure["code"]) &&
    typeof value.message === "string"
  );
}

function createSessionEventStreamResponse(
  coordinator: BrowserAgentLaunchCoordinator,
  request: BrowserAgentSessionEventStreamRequest,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const fail = (error: unknown) => {
        if (!closed) {
          closed = true;
          controller.error(error instanceof Error ? error : new Error(String(error)));
        }
      };

      const abortListener = () => {
        close();
      };
      signal.addEventListener("abort", abortListener, { once: true });

      void coordinator
        .observeSessionEvents(
          request,
          (message) => {
            if (closed) {
              return;
            }
            controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
          },
          signal,
        )
        .then(close)
        .catch(fail)
        .finally(() => {
          signal.removeEventListener("abort", abortListener);
        });
    },
  });

  return new Response(stream, {
    headers: streamingHeaders(),
    status: 200,
  });
}

export function createBrowserAgentServer(
  workflowResult: ValidationResult<Workflow>,
  dependencies: BrowserAgentServerDependencies = {},
): BrowserAgentServer {
  const now = dependencies.now ?? (() => new Date());
  const coordinator = dependencies.coordinator;
  const context = buildContext(workflowResult, coordinator, now);

  return {
    context,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-headers": "content-type",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
          },
        });
      }

      if (url.pathname === browserAgentHealthPath) {
        if (request.method !== "GET") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { allow: "GET" },
          });
        }
        return jsonResponse({
          ok: true,
          runtime: {
            activeSessionLookupPath: browserAgentActiveSessionPath,
            launchPath: browserAgentLaunchPath,
            sessionEventsPath: browserAgentSessionEventsPath,
            startedAt: context.startedAt,
            status: context.status,
            statusMessage: context.statusMessage,
            version: 1,
          },
        } satisfies BrowserAgentHealthResponse);
      }

      if (url.pathname === browserAgentLaunchPath) {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { allow: "POST" },
          });
        }
        if (!coordinator || context.status !== "ready") {
          return jsonResponse(createUnavailableLaunchFailure(context.statusMessage));
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Request body must be valid JSON.", 400);
        }
        try {
          const result = await coordinator.launchSession(parseLaunchRequest(body));
          if (isLaunchFailure(result) && result.code === "local-bridge-unavailable") {
            return jsonResponse(result, 503);
          }
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            createUnavailableLaunchFailure(error instanceof Error ? error.message : String(error)),
            503,
          );
        }
      }

      if (url.pathname === browserAgentActiveSessionPath) {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { allow: "POST" },
          });
        }
        if (!coordinator || context.status !== "ready") {
          return jsonResponse(createUnavailableLaunchFailure(context.statusMessage), 503);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Request body must be valid JSON.", 400);
        }
        try {
          return jsonResponse(
            await coordinator.lookupActiveSession(parseActiveSessionLookupRequest(body)),
          );
        } catch (error) {
          return jsonResponse(
            createUnavailableLaunchFailure(error instanceof Error ? error.message : String(error)),
            503,
          );
        }
      }

      if (url.pathname === browserAgentSessionEventsPath) {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { allow: "POST" },
          });
        }
        if (!coordinator || context.status !== "ready") {
          return jsonResponse(createUnavailableLaunchFailure(context.statusMessage), 503);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Request body must be valid JSON.", 400);
        }
        try {
          return createSessionEventStreamResponse(
            coordinator,
            parseSessionEventStreamRequest(body),
            request.signal,
          );
        } catch (error) {
          return jsonResponse(
            createUnavailableLaunchFailure(error instanceof Error ? error.message : String(error)),
            503,
          );
        }
      }

      return errorResponse(
        `Browser-agent route "${url.pathname}" was not found.`,
        404,
        "not-found",
      );
    },
  };
}

export async function runBrowserAgentCli(
  args: string[],
  dependencies: BrowserAgentServerDependencies = {},
) {
  const options = parseBrowserAgentCliArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  const loadWorkflow = dependencies.loadWorkflow ?? loadWorkflowFile;
  const workflowResult = await loadWorkflow(options.workflowPath, process.cwd());
  const server = createBrowserAgentServer(workflowResult, dependencies);
  const serve = dependencies.serve ?? Bun.serve;
  const stdout = dependencies.stdout ?? console;

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4317;
  const handle = serve({
    hostname: host,
    port,
    fetch: server.fetch,
  });

  stdout.log(`browser-agent listening on http://${host}:${handle.port}`);
  if (server.context.status !== "ready") {
    stdout.error(`browser-agent unavailable: ${server.context.statusMessage}`);
  }
}
