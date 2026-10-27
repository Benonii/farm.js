import type { ConvexExtension, ConvexPolarOptions } from "./types.js";

const DEFAULT_CONVEX_PATH = "/polar/events";

/** Polar running in Convex as the @convex-dev/polar component. */
export function polar(options: ConvexPolarOptions = {}): ConvexExtension {
  const convexPath = options.convexPath ?? DEFAULT_CONVEX_PATH;
  return {
    name: "polar",
    owns: "billing",
    component: "@convex-dev/polar",
    routes: options.webhooks ? [{ path: options.webhooks, methods: ["POST"], to: convexPath }] : [],
  };
}

export type { ConvexPolarOptions } from "./types.js";
