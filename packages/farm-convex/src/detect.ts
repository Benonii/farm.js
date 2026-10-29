import { autumn } from "./autumn.js";
import { betterAuth } from "./better-auth.js";
import { readExtensionService } from "./component.js";
import { findComponentPackages, readConvexConfigSource } from "./homes.js";
import { polar } from "./polar.js";
import { resend } from "./resend.js";
import { stripe } from "./stripe.js";
import { workosAuthKit } from "./workos.js";

import type { ConvexExtension, ConvexHomes } from "./types.js";

const HELPERS: Readonly<Record<string, () => ConvexExtension>> = {
  "@convex-dev/better-auth": betterAuth,
  "@convex-dev/polar": () => polar(),
  "@convex-dev/stripe": () => stripe(),
  "@useautumn/convex": autumn,
  "@convex-dev/resend": () => resend(),
  "@convex-dev/workos-authkit": () => workosAuthKit(),
};

/** Helpers for the components installed in convex.config.ts, minus services whose home is Farm. */
export function detectExtensions(
  root: string,
  functionsDirectory: string,
  homes: ConvexHomes,
): ConvexExtension[] {
  const source = readConvexConfigSource(root, functionsDirectory) ?? "";
  return findComponentPackages(source)
    .flatMap((name) => (HELPERS[name] ? [HELPERS[name]()] : []))
    .filter((extension) => {
      const service = readExtensionService(extension);
      return !service || homes[service] !== "farm";
    });
}

/** An extension listed in `use` replaces the detected one for the same component. */
export function mergeExtensions(
  detected: readonly ConvexExtension[],
  explicit: readonly ConvexExtension[],
): ConvexExtension[] {
  const listed = new Set(explicit.map(({ component }) => component).filter(Boolean));
  return [...detected.filter(({ component }) => !listed.has(component)), ...explicit];
}
