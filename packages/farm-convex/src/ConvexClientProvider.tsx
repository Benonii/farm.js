"use client";

import { ConvexProvider } from "convex/react";

import { readConvexReactClient } from "./clients.js";

import type { ConvexProviderProps } from "./types.js";

export const ConvexClientProvider = ({ url, children }: ConvexProviderProps) => (
  <ConvexProvider client={readConvexReactClient(url)}>{children}</ConvexProvider>
);
