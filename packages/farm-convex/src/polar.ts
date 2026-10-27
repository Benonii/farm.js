import { component } from "./component.js";

import type { ConvexExtension, ConvexPolarOptions } from "./types.js";

const DEFAULT_CONVEX_PATH = "/polar/events";

/** Polar running in Convex as the @convex-dev/polar component. */
export function polar(options: ConvexPolarOptions = {}): ConvexExtension {
  const convexPath = options.convexPath ?? DEFAULT_CONVEX_PATH;
  return component("@convex-dev/polar", {
    name: "polar",
    owns: "billing",
    routes: options.webhooks ? [{ path: options.webhooks, methods: ["POST"], to: convexPath }] : [],
  });
}

export type { ConvexPolarOptions } from "./types.js";
