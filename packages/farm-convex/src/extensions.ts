import { forwardRequest } from "./forward.js";

import type { FarmIntegrationRoute } from "@farm.js/core";
import type { ConvexExtension } from "./types.js";

const DEFAULT_METHODS = ["GET", "POST"] as const;

function listOwners(extensions: readonly ConvexExtension[], key: "token" | "provider"): string[] {
  return extensions.filter((extension) => extension[key] !== undefined).map(({ name }) => name);
}

function checkSingleOwner(extensions: readonly ConvexExtension[], key: "token" | "provider") {
  const owners = listOwners(extensions, key);
  if (owners.length > 1) {
    throw new Error(
      `Convex integration: ${owners.join(" and ")} both set a ${key}. Use one of them, or pass convex({ ${key} }) to choose.`,
    );
  }
}

function checkServiceOwners(extensions: readonly ConvexExtension[]): void {
  const owners = new Map<string, string>();
  for (const { name, owns } of extensions) {
    if (!owns) continue;
    const owner = owners.get(owns);
    if (owner) {
      throw new Error(`Convex integration: ${owner} and ${name} both own ${owns}. Keep one.`);
    }
    owners.set(owns, name);
  }
}

function checkRoutePaths(extensions: readonly ConvexExtension[]): void {
  const owners = new Map<string, string>();
  for (const { name, routes = [] } of extensions) {
    for (const { path, to } of routes) {
      if (!path.startsWith("/") || (to !== undefined && !to.startsWith("/"))) {
        throw new Error(`Convex integration: ${name} routes must be paths starting with "/".`);
      }
      const owner = owners.get(path);
      if (owner) throw new Error(`Convex integration: ${owner} and ${name} both route ${path}.`);
      owners.set(path, name);
    }
  }
}

export function checkExtensions(extensions: readonly ConvexExtension[]): void {
  checkServiceOwners(extensions);
  checkSingleOwner(extensions, "token");
  checkSingleOwner(extensions, "provider");
  checkRoutePaths(extensions);
}

export function pickExtensionValue<Key extends "token" | "provider">(
  extensions: readonly ConvexExtension[],
  key: Key,
): ConvexExtension[Key] {
  return extensions.find((extension) => extension[key] !== undefined)?.[key];
}

export function createExtensionRoutes(
  extensions: readonly ConvexExtension[],
  siteURL: string,
): FarmIntegrationRoute[] {
  return extensions.flatMap(({ routes = [] }) =>
    routes.map((route) => ({
      path: route.path,
      methods: route.methods ?? DEFAULT_METHODS,
      handler: (request: Request) => forwardRequest(request, siteURL, route.to),
    })),
  );
}
