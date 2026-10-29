import type { ConvexComponentOptions, ConvexExtension, ConvexExtensionRoute } from "./types.js";
import type { ConvexService, ConvexWebhookOptions, ConvexWebhookService } from "./types.js";

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
  const path = options.webhooks === true ? service.defaultWebhookPath : options.webhooks;
  const extension = component(service.component, {
    name: service.name,
    routes: path ? [{ path, methods: ["POST"], to }] : [],
  });
  return service.service ? { ...extension, service: service.service } : extension;
}

/** The kind of service an extension provides; sign-in (a token or provider) means auth. */
export function readExtensionService(extension: ConvexExtension): ConvexService | undefined {
  if (extension.service) return extension.service;
  return extension.token || extension.provider ? "auth" : undefined;
}
