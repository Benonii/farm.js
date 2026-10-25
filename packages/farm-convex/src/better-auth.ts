import { readConvexRuntime } from "./runtime.js";
import { forwardRequest } from "./forward.js";

import type { ConvexBetterAuthInstance, ConvexBetterAuthOptions } from "./types.js";

const TOKEN_PATH = "/api/auth/convex/token";
const SESSION_COOKIE_MARKER = "session_token=";

function resolveSiteURL(options: ConvexBetterAuthOptions): string {
  const siteURL = options.siteURL ?? readConvexRuntime()?.siteURL;
  if (!siteURL) {
    throw new Error(
      "convexBetterAuth() needs convex() in the farm.config.ts integrations, or an explicit siteURL option.",
    );
  }
  return siteURL;
}

function isTokenPayload(value: unknown): value is { token: string } {
  return (
    typeof value === "object" && value !== null && typeof Reflect.get(value, "token") === "string"
  );
}

async function fetchConvexToken(request: Request, siteURL: string): Promise<string | undefined> {
  const cookie = request.headers.get("cookie");
  if (!cookie?.includes(SESSION_COOKIE_MARKER)) return undefined;
  const response = await fetch(new URL(TOKEN_PATH, siteURL), {
    headers: { cookie, "accept-encoding": "identity" },
  });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return isTokenPayload(payload) ? payload.token : undefined;
}

export function convexBetterAuth(options: ConvexBetterAuthOptions = {}): ConvexBetterAuthInstance {
  return {
    kind: "convex-better-auth",
    handler: (request) => forwardRequest(request, resolveSiteURL(options)),
    token: (request) => fetchConvexToken(request, resolveSiteURL(options)),
  };
}
