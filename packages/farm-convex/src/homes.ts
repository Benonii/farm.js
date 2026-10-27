import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CONVEX_COMPONENT_SERVICES, CONVEX_PAIRS } from "./pairs.js";
import { FARM_BUILT_IN_AUTH, FARM_INTEGRATION_SERVICES } from "./pairs.js";

import type { ConvexExtension, ConvexFarmConfigView, ConvexHomeConflict } from "./types.js";
import type { ConvexHomes, ConvexServiceSetup } from "./types.js";

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

// An extension that owns a service counts even before its component is installed.
export function findExtensionServices(
  extensions: readonly ConvexExtension[],
): ConvexServiceSetup[] {
  return extensions.flatMap(({ name, owns, component }) =>
    owns ? [{ service: owns, side: "convex", name: component ?? name }] : [],
  );
}

function mergeConvexServices(
  components: readonly ConvexServiceSetup[],
  extensions: readonly ConvexServiceSetup[],
): ConvexServiceSetup[] {
  const names = new Set(components.map((setup) => setup.name));
  return [...components, ...extensions.filter((setup) => !names.has(setup.name))];
}

function warnMissingComponents(source: string, extensions: readonly ConvexExtension[]): void {
  for (const { name, component } of extensions) {
    if (!component || source.includes(`${component}/convex.config`)) continue;
    console.warn(
      `[farm:convex] ${name}() needs ${component} in convex.config.ts. Add app.use() for it there.`,
    );
  }
}

function isBuiltInAuthEnabled(auth: unknown): boolean {
  if (typeof auth === "boolean") return auth;
  if (typeof auth !== "object" || auth === null) return false;
  return Reflect.get(auth, "enabled") !== false;
}

export function findFarmIntegrations(config: ConvexFarmConfigView): ConvexServiceSetup[] {
  const names = Object.values(config.integrations ?? {})
    .flatMap((integration) => (integration ? [integration.type] : []))
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
  extensions: readonly ConvexExtension[] = [],
): void {
  const source = readConvexConfigSource(config.root ?? process.cwd(), functionsDirectory) ?? "";
  warnMissingComponents(source, extensions);
  const conflicts = findHomeConflicts(
    mergeConvexServices(findConvexComponents(source), findExtensionServices(extensions)),
    findFarmIntegrations(config),
    homes,
  );
  if (conflicts.length === 0) return;
  throw new Error(`Convex integration:\n${conflicts.map(describeHomeConflict).join("\n")}`);
}
