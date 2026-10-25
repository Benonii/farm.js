import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CONVEX_BETTER_AUTH_FORWARDING, CONVEX_COMPONENT_SERVICES, CONVEX_PAIRS } from "./pairs.js";
import { FARM_BUILT_IN_AUTH, FARM_INTEGRATION_SERVICES } from "./pairs.js";

import type { ConvexFarmConfigView, ConvexHomeConflict, ConvexHomes } from "./types.js";
import type { ConvexIntegrationView, ConvexServiceSetup } from "./types.js";

const COMPONENT_IMPORT_PATTERN =
  /from\s+["']((?:@[\w.-]+\/)?[\w.-]+)\/convex\.config(?:\.js)?["']/g;
const CONFIG_FILE_NAMES = ["convex.config.ts", "convex.config.js"];

function readConvexConfigSource(root: string, functionsDirectory: string): string | undefined {
  const filePath = CONFIG_FILE_NAMES.map((name) => path.join(root, functionsDirectory, name)).find(
    (candidate) => existsSync(candidate),
  );
  return filePath ? readFileSync(filePath, "utf8") : undefined;
}

export function findConvexComponents(source: string): ConvexServiceSetup[] {
  return [...source.matchAll(COMPONENT_IMPORT_PATTERN)]
    .map((match) => match[1])
    .filter((name) => CONVEX_COMPONENT_SERVICES[name] !== undefined)
    .map((name) => ({ service: CONVEX_COMPONENT_SERVICES[name], side: "convex", name }));
}

function nameIntegration(integration: ConvexIntegrationView): string | undefined {
  const instance = integration.instance;
  const isForwarding =
    typeof instance === "object" &&
    instance !== null &&
    Reflect.get(instance, "kind") === "convex-better-auth";
  return isForwarding ? CONVEX_BETTER_AUTH_FORWARDING : integration.type;
}

function isBuiltInAuthEnabled(auth: unknown): boolean {
  if (typeof auth === "boolean") return auth;
  if (typeof auth !== "object" || auth === null) return false;
  return Reflect.get(auth, "enabled") !== false;
}

export function findFarmIntegrations(config: ConvexFarmConfigView): ConvexServiceSetup[] {
  const names = Object.values(config.integrations ?? {})
    .flatMap((integration) => (integration ? [nameIntegration(integration)] : []))
    .concat(isBuiltInAuthEnabled(config.auth) ? [FARM_BUILT_IN_AUTH] : []);
  return names
    .filter(
      (name): name is string => name !== undefined && FARM_INTEGRATION_SERVICES[name] !== undefined,
    )
    .map((name) => ({ service: FARM_INTEGRATION_SERVICES[name], side: "farm", name }));
}

function isTogether(component: string, integration: string): boolean {
  return CONVEX_PAIRS.some(
    (pair) =>
      pair.component === component &&
      pair.integration === integration &&
      pair.relation === "together",
  );
}

export function findHomeConflicts(
  components: readonly ConvexServiceSetup[],
  integrations: readonly ConvexServiceSetup[],
  homes: ConvexHomes,
): ConvexHomeConflict[] {
  return components.flatMap((component) =>
    integrations
      .filter(
        (integration) => integration.service === component.service && !homes[component.service],
      )
      .filter((integration) => !isTogether(component.name, integration.name))
      .map((integration) => ({
        service: component.service,
        component: component.name,
        integration: integration.name,
      })),
  );
}

export function describeHomeConflict(conflict: ConvexHomeConflict): string {
  return `${conflict.service} is set up in Convex (${conflict.component}) and in Farm (${conflict.integration}). Remove one, or set convex({ home: { ${conflict.service}: "convex" } }) or "farm" to say which side owns it.`;
}

export function checkServiceHomes(
  config: ConvexFarmConfigView,
  functionsDirectory: string,
  homes: ConvexHomes,
): void {
  const source = readConvexConfigSource(config.root ?? process.cwd(), functionsDirectory);
  if (!source) return;
  const conflicts = findHomeConflicts(
    findConvexComponents(source),
    findFarmIntegrations(config),
    homes,
  );
  if (conflicts.length === 0) return;
  throw new Error(`Convex integration:\n${conflicts.map(describeHomeConflict).join("\n")}`);
}
