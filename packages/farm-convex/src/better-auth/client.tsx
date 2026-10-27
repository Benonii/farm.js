"use client";

import { ConvexBetterAuthProvider as BetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { readConvexReactClient } from "../clients.js";

import type { ConvexProviderProps } from "../types.js";

/** Better Auth's browser client, calling /api/auth on the app's own domain. */
export const authClient = createAuthClient({ plugins: [convexClient()] });

export const ConvexBetterAuthProvider = ({ url, children }: ConvexProviderProps) => (
  <BetterAuthProvider client={readConvexReactClient(url)} authClient={authClient}>
    {children}
  </BetterAuthProvider>
);
