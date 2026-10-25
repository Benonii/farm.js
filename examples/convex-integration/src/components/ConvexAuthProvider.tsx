"use client";

import type { ReactNode } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { readConvexReactClient } from "@farm.js/convex/client";
import { authClient } from "../lib/auth-client";

interface ConvexAuthProviderProps {
  url: string;
  children?: ReactNode;
}

export function ConvexAuthProvider({ url, children }: ConvexAuthProviderProps) {
  return (
    <ConvexBetterAuthProvider client={readConvexReactClient(url)} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
