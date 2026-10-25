import { defineConfig } from "@farm.js/core";
import { betterAuth } from "@farm.js/better-auth";
import { convex, convexStorage } from "@farm.js/convex";
import { convexBetterAuth } from "@farm.js/convex/better-auth";

const auth = convexBetterAuth();

export default defineConfig({
  experimental: {
    serverComponents: true,
  },
  integrations: {
    convex: convex({
      token: auth.token,
      provider: { module: "@/components/ConvexAuthProvider", export: "ConvexAuthProvider" },
    }),
    auth: betterAuth({ instance: auth }),
  },
  storage: {
    mounts: {
      notes: convexStorage({ namespace: "notes" }),
    },
  },
});
