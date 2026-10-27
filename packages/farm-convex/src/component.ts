import type { ConvexComponentOptions, ConvexExtension, ConvexExtensionRoute } from "./types.js";
import type { ConvexWebhookOptions, ConvexWebhookService } from "./types.js";

function toRoutes(routes: ConvexComponentOptions["routes"]): readonly ConvexExtensionRoute[] {
  if (!routes) return [];
  if (Array.isArray(routes)) return routes;
  return Object.entries(routes).map(([path, to]) => ({ path, to }));
}

/** Any Convex component, such as "@convex-dev/resend", wired into Farm by convex({ use }). */
export function component(
  packageName: string,
  { name, routes, ...options }: ConvexComponentOptions = {},
): ConvexExtension {
  if (!packageName.trim()) throw new TypeError("component() needs the component's package name.");
  return {
    ...options,
    name: name ?? packageName,
    component: packageName,
    routes: toRoutes(routes),
  };
}

/** A component whose webhooks can arrive on your own domain and go on to Convex. */
export function webhookComponent(
  service: ConvexWebhookService,
  options: ConvexWebhookOptions = {},
): ConvexExtension {
  const to = options.convexPath ?? service.defaultConvexPath;
  return component(service.component, {
    name: service.name,
    owns: service.owns,
    routes: options.webhooks ? [{ path: options.webhooks, methods: ["POST"], to }] : [],
  });
}
