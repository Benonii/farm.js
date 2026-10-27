import { webhookComponent } from "./component.js";

import type { ConvexExtension, ConvexWebhookOptions } from "./types.js";

/** Resend email running in Convex as the @convex-dev/resend component. */
export function resend(options: ConvexWebhookOptions = {}): ConvexExtension {
  return webhookComponent(
    {
      name: "resend",
      component: "@convex-dev/resend",
      defaultConvexPath: "/resend-webhook",
    },
    options,
  );
}

export type { ConvexWebhookOptions } from "./types.js";
