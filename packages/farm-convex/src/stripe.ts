import { webhookComponent } from "./component.js";

import type { ConvexExtension, ConvexWebhookOptions } from "./types.js";

/** Stripe running in Convex as the @convex-dev/stripe component. */
export function stripe(options: ConvexWebhookOptions = {}): ConvexExtension {
  return webhookComponent(
    {
      name: "stripe",
      component: "@convex-dev/stripe",
      owns: "billing",
      defaultConvexPath: "/stripe/webhook",
    },
    options,
  );
}

export type { ConvexWebhookOptions } from "./types.js";
