import { component } from "./component.js";

import type { ConvexExtension } from "./types.js";

/** Autumn billing running in Convex as the @useautumn/convex component. */
export function autumn(): ConvexExtension {
  return { ...component("@useautumn/convex", { name: "autumn" }), service: "billing" };
}
