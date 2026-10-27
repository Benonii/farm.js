import { defineConfig } from "@farm.js/core";
import { convex, convexStorage } from "@farm.js/convex";
import { betterAuth } from "@farm.js/convex/better-auth";

export default defineConfig({
  experimental: {
    serverComponents: true,
  },
  integrations: {
    convex: convex({ use: [betterAuth()] }),
  },
  storage: {
    mounts: {
      notes: convexStorage({ namespace: "notes" }),
    },
  },
});
