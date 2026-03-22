import { GraphValidationError, type GraphWriteTransaction } from "@io/core/graph";

import type {
  WebAppAuthority,
  WebAppAuthorityCommand,
  WebAppAuthorityCommandResult,
} from "./authority.js";

export function handleSyncRequest(request: Request, authority: WebAppAuthority): Response {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  const after = new URL(request.url).searchParams.get("after")?.trim();
  const payload = after ? authority.getIncrementalSyncResult(after) : authority.createSyncPayload();

  return Response.json(payload, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function isHttpError(error: unknown): error is Error & { readonly status: number } {
  return error instanceof Error && typeof (error as { status?: unknown }).status === "number";
}

function formatGraphValidationError(error: GraphValidationError): string {
  return error.result.issues[0]?.message ?? error.message;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isSupportedWebAppAuthorityCommand(value: unknown): value is WebAppAuthorityCommand {
  return (
    isObjectRecord(value) && value.kind === "write-secret-field" && isObjectRecord(value.input)
  );
}

function authorityCommandSuccessStatus(
  command: WebAppAuthorityCommand,
  result: WebAppAuthorityCommandResult,
): number {
  if (command.kind === "write-secret-field") {
    return result.created ? 201 : 200;
  }

  return 200;
}

async function executeCommandRequest(
  command: WebAppAuthorityCommand,
  authority: WebAppAuthority,
): Promise<Response> {
  try {
    const result = await authority.executeCommand(command);
    return Response.json(result, {
      status: authorityCommandSuccessStatus(command, result),
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return errorResponse(error.message, error.status);
    }
    throw error;
  }
}

export async function handleTransactionRequest(
  request: Request,
  authority: WebAppAuthority,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  let transaction: GraphWriteTransaction;
  try {
    transaction = (await request.json()) as GraphWriteTransaction;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  try {
    const result = await authority.applyTransaction(transaction);
    return Response.json(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof GraphValidationError) {
      return errorResponse(formatGraphValidationError(error), 400);
    }
    throw error;
  }
}

export async function handleCommandRequest(
  request: Request,
  authority: WebAppAuthority,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  if (!isSupportedWebAppAuthorityCommand(body)) {
    return errorResponse("Request body must be a supported web authority command.", 400);
  }

  return executeCommandRequest(body, authority);
}
