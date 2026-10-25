import { defineIntegration } from "@farm.js/core";

import { createConvexPlugin, resolveDevOptions } from "./dev.js";
import { resolveDeploymentURLs } from "./environment.js";
import { setConvexRuntime } from "./runtime.js";

import type { ConvexIntegrationInput } from "./types.js";

const DEFAULT_PROVIDER = { module: "@farm.js/convex/client", export: "ConvexClientProvider" };
const DEFAULT_FUNCTIONS_DIRECTORY = "convex";

export function convex(input: ConvexIntegrationInput = {}) {
  const urls = resolveDeploymentURLs(input);
  setConvexRuntime({ ...urls, token: input.token });
  return defineIntegration({
    category: "database",
    type: "convex",
    instance: urls,
    log: input.log,
    providers: [
      {
        name: "convex-provider",
        type: "convex",
        props: { url: urls.url },
        supportsIsolatedHydration: true,
        component: input.provider ?? DEFAULT_PROVIDER,
      },
    ],
    plugins: [
      createConvexPlugin({
        dev: resolveDevOptions(input.dev),
        homes: input.home ?? {},
        functionsDirectory: input.functionsDirectory ?? DEFAULT_FUNCTIONS_DIRECTORY,
      }),
    ],
  });
}

export { convexRateLimitStorage } from "./rate-limit.js";
export { convexStorage } from "./storage.js";
export { CONVEX_PAIRS } from "./pairs.js";
export type {
  ConvexAdapterOptions,
  ConvexDevOptions,
  ConvexHomes,
  ConvexIntegrationInput,
  ConvexPair,
  ConvexService,
  ConvexServiceSide,
  ConvexTokenReader,
} from "./types.js";
