import { readConvexRuntime } from "./runtime.js";

import type { ConvexExtension } from "./types.js";

const TOKEN_PATH = "/api/auth/convex/token";
const SESSION_COOKIE_MARKER = "session_token=";

function requireSiteURL(): string {
  const siteURL = readConvexRuntime()?.siteURL;
  if (!siteURL) {
    throw new Error("betterAuth() from @farm.js/convex/better-auth goes in convex({ use }).");
  }
  return siteURL;
}

function isTokenPayload(value: unknown): value is { token: string } {
  return (
    typeof value === "object" && value !== null && typeof Reflect.get(value, "token") === "string"
  );
}

async function readTokenPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function fetchBetterAuthToken(
  request: Request,
  siteURL: string,
): Promise<string | undefined> {
  const cookie = request.headers.get("cookie");
  if (!cookie?.includes(SESSION_COOKIE_MARKER)) return undefined;
  const response = await fetch(new URL(TOKEN_PATH, siteURL), {
    headers: { cookie, "accept-encoding": "identity" },
  });
  if (!response.ok) return undefined;
  const payload = await readTokenPayload(response);
  return isTokenPayload(payload) ? payload.token : undefined;
}

/** Better Auth running in Convex as the @convex-dev/better-auth component. */
export function betterAuth(): ConvexExtension {
  return {
    name: "better-auth",
    owns: "auth",
    component: "@convex-dev/better-auth",
    routes: [{ path: "/api/auth/[...auth]" }],
    token: (request) => fetchBetterAuthToken(request, requireSiteURL()),
    provider: { module: "@farm.js/convex/better-auth/client", export: "ConvexBetterAuthProvider" },
  };
}
