import { webhookComponent } from "./component.js";

import type { ConvexExtension, ConvexWebhookOptions } from "./types.js";

/** Stripe running in Convex as the @convex-dev/stripe component. */
export function stripe(options: ConvexWebhookOptions = {}): ConvexExtension {
  return webhookComponent(
    {
      name: "stripe",
      component: "@convex-dev/stripe",
      service: "billing",
      defaultConvexPath: "/stripe/webhook",
      defaultWebhookPath: "/api/webhooks/stripe",
    },
    options,
  );
}

export type { ConvexWebhookOptions } from "./types.js";
