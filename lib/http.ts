/**
 * Small helpers for consistent JSON API responses and zod error formatting.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function zodError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError("Invalid request", 400, err.issues);
  }
  return jsonError("Invalid request body", 400, String(err));
}

export function unauthorized() {
  return jsonError("Unauthorized", 401);
}

export function notFound(what = "Resource") {
  return jsonError(`${what} not found`, 404);
}
