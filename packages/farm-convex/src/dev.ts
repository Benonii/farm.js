import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { definePlugin } from "@farm.js/core/plugin";

import { checkServiceHomes } from "./homes.js";

import type { ConvexDevOptions, ConvexDevState, ConvexFarmConfigView } from "./types.js";
import type { ConvexPluginInput } from "./types.js";

const CONVEX_BINARY = process.platform === "win32" ? "convex.cmd" : "convex";

export function resolveDevOptions(
  dev: boolean | ConvexDevOptions | undefined,
): ConvexDevOptions | undefined {
  if (dev === false) return undefined;
  return dev === true || dev === undefined ? {} : dev;
}

function findConvexBinary(root: string): string | undefined {
  const binaryPath = path.join(root, "node_modules", ".bin", CONVEX_BINARY);
  return existsSync(binaryPath) ? binaryPath : undefined;
}

export function startConvexDev(
  root: string,
  options: ConvexDevOptions,
  state: ConvexDevState,
): void {
  const binaryPath = findConvexBinary(root);
  if (!binaryPath) {
    console.warn(
      "[farm:convex] convex is not installed in this app, so `convex dev` was not started.",
    );
    return;
  }
  state.child = spawn(binaryPath, ["dev", ...(options.args ?? [])], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const stopWithFarm = () => stopConvexDev(state);
  process.once("exit", stopWithFarm);
  state.child.once("exit", () => {
    process.off("exit", stopWithFarm);
    state.child = undefined;
  });
}

export function stopConvexDev(state: ConvexDevState | undefined): void {
  if (!state?.child || state.child.exitCode !== null) return;
  state.child.kill("SIGINT");
  state.child = undefined;
}

export function createConvexPlugin(input: ConvexPluginInput) {
  let root = process.cwd();
  return definePlugin<ConvexDevState>({
    name: "farm:convex",
    configure(config) {
      const view = config as ConvexFarmConfigView;
      root = path.resolve(view.root ?? root);
      checkServiceHomes({ ...view, root }, input.functionsDirectory, input.homes);
    },
    setup: () => ({}),
    dev: {
      server(viteServer, { state, lifecycle }) {
        if (!input.dev) return;
        startConvexDev(root, input.dev, state);
        viteServer.httpServer?.once("close", () => stopConvexDev(state));
        lifecycle.onShutdown(() => stopConvexDev(state));
      },
    },
    runtime: {
      close: ({ state }) => stopConvexDev(state),
    },
  });
}
