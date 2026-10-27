import { webhookComponent } from "./component.js";

import type { ConvexExtension, ConvexWebhookOptions } from "./types.js";

/** WorkOS AuthKit users synced into Convex by the @convex-dev/workos-authkit component. */
export function workosAuthKit(options: ConvexWebhookOptions = {}): ConvexExtension {
  return webhookComponent(
    {
      name: "workosAuthKit",
      component: "@convex-dev/workos-authkit",
      owns: "auth",
      defaultConvexPath: "/workos/webhook",
      defaultWebhookPath: "/api/webhooks/workos",
    },
    options,
  );
}

export type { ConvexWebhookOptions } from "./types.js";
