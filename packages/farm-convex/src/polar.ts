import { webhookComponent } from "./component.js";

import type { ConvexExtension, ConvexWebhookOptions } from "./types.js";

/** Polar running in Convex as the @convex-dev/polar component. */
export function polar(options: ConvexWebhookOptions = {}): ConvexExtension {
  return webhookComponent(
    {
      name: "polar",
      component: "@convex-dev/polar",
      service: "billing",
      defaultConvexPath: "/polar/events",
      defaultWebhookPath: "/api/webhooks/polar",
    },
    options,
  );
}

export type { ConvexWebhookOptions } from "./types.js";
