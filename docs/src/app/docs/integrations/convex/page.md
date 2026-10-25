---
title: "Convex Integration"
description: "Use Convex for live data in a Farm app: a browser provider, server-rendered queries, the convex dev runner, Better Auth on Convex, and Convex-backed rate limits and KV storage."
section: "Integrations"
---

# Convex Integration

[Convex](https://convex.dev) is a backend where queries are live: when data changes, every open
page that reads it updates. `@farm.js/convex` connects a Farm app to a Convex deployment. It wraps
the app in a Convex provider, gives server-rendered pages a Convex client for the current visitor,
starts `convex dev` with `farm dev`, and plugs Convex into Farm's auth, rate-limit, and KV storage
slots.

> **Experimental**
>
> `@farm.js/convex` is new. Its API can change in a minor release while it settles.

## Install

**Terminal**

```bash
pnpm add @farm.js/convex convex
npx convex dev
```

The first `npx convex dev` creates a deployment and writes `CONVEX_URL` to `.env.local`. In a
project that depends on Vite it writes `VITE_CONVEX_URL` instead; Farm reads either name. For a
free local deployment with no Convex account, run `CONVEX_AGENT_MODE=anonymous npx convex dev`.

## Register it

**farm.config.ts**

```ts
import { defineConfig } from "@farm.js/core";
import { convex } from "@farm.js/convex";

export default defineConfig({
  integrations: {
    convex: convex(),
  },
});
```

`convex()` does four things:

- Checks `CONVEX_URL` and `CONVEX_SITE_URL` at startup. A missing URL, or a `.convex.site` URL
  where the `.convex.cloud` one belongs, fails with an error that names the fix. When
  `CONVEX_SITE_URL` is not set, Farm works it out from `CONVEX_URL`.
- Wraps every route in a Convex provider, so `useQuery`, `useMutation`, and `useAction` from
  `convex/react` work in client components. Only the public deployment URL reaches the browser.
- Starts `convex dev` when `farm dev` starts, and stops it when Farm stops. It never runs during
  `farm build` or in production.
- Checks that auth and billing are not set up twice, once in Convex and once in Farm. See
  [Choose where a service lives](#choose-where-a-service-lives).

## Load data on the server

Use `preloadQuery` in an async page and pass the result to a client component. The page renders
with the data in its HTML, and the client component keeps it live with `usePreloadedQuery`.

**src/app/page.tsx**

```tsx
import { preloadQuery } from "@farm.js/convex/server";
import { api } from "../../convex/_generated/api";
import { Messages } from "../components/Messages";

export default async function HomePage() {
  const messages = await preloadQuery(api.messages.list);
  return <Messages preloaded={messages} />;
}
```

**src/components/Messages.tsx**

```tsx
"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Messages({ preloaded }: { preloaded: Preloaded<typeof api.messages.list> }) {
  const messages = usePreloadedQuery(preloaded);
  return (
    <ul>
      {messages.map((message) => (
        <li key={message.id}>{message.body}</li>
      ))}
    </ul>
  );
}
```

`fetchQuery`, `fetchMutation`, and `fetchAction` from `@farm.js/convex/server` run a function once
and return its result. Use them in pages, API routes, and server actions.

| Option    | What it does                                                                   |
| --------- | ------------------------------------------------------------------------------ |
| `request` | The request to read the visitor's token from. Defaults to the current request. |
| `token`   | A token to send as-is. Skips the `token` reader configured on `convex()`.      |

Each call makes its own client, so two visitors rendering at the same time never share a token.

### Caching

A page that calls `preloadQuery` reads the current request, so Farm treats its HTML as
per-visitor: it is sent with `Cache-Control: private, no-store` and is never written to the shared
page cache. This keeps live data from being served stale. Data that is the same for everyone and
can be stale for a while belongs in a [cached query](/docs/cache-ppr) instead.

## Choose client ownership

By default Farm creates one `ConvexReactClient` per deployment URL in the browser. To wrap the app
in your own provider, for example one that also handles auth, pass a component reference:

**farm.config.ts**

```ts
convex({
  provider: { module: "@/components/ConvexAuthProvider", export: "ConvexAuthProvider" },
});
```

The component receives the deployment URL as `url`. Use `readConvexReactClient(url)` from
`@farm.js/convex/client` to get the shared client instead of constructing a second one.

## Auth with Better Auth running in Convex

When Better Auth runs as the `@convex-dev/better-auth` component, `convexBetterAuth()` gives
Farm's [Better Auth integration](/docs/integrations/auth/better-auth) an instance that forwards
`/api/auth/*` to your Convex site URL. Sign-in then happens on your own domain, so session cookies
are first-party and server-rendered pages know who is signed in.

**farm.config.ts**

```ts
import { defineConfig } from "@farm.js/core";
import { betterAuth } from "@farm.js/better-auth";
import { convex } from "@farm.js/convex";
import { convexBetterAuth } from "@farm.js/convex/better-auth";

const auth = convexBetterAuth();

export default defineConfig({
  integrations: {
    convex: convex({
      token: auth.token,
      provider: { module: "@/components/ConvexAuthProvider", export: "ConvexAuthProvider" },
    }),
    auth: betterAuth({ instance: auth }),
  },
});
```

`auth.token` exchanges the visitor's session cookie for a Convex token, so `preloadQuery` and the
other server helpers run as the signed-in user. Visitors without a session cookie cost no network
call.

On the Convex side, set Better Auth's `baseURL` to your app's URL, not the Convex site URL:

**convex/auth.ts**

```ts
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (context: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(context),
    emailAndPassword: { enabled: true },
    plugins: [convex({ authConfig })],
  });
```

In the browser, create the auth client without a `baseURL` so it calls your own domain, and wrap
the app in `ConvexBetterAuthProvider`:

**src/components/ConvexAuthProvider.tsx**

```tsx
"use client";

import type { ReactNode } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { readConvexReactClient } from "@farm.js/convex/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [convexClient()] });

export function ConvexAuthProvider({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={readConvexReactClient(url)} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

Because sign-in now goes through your domain, OAuth providers call back to
`https://<your-app>/api/auth/callback/<provider>`. Update the callback URL in each provider's
console when you move an app from the cross-domain setup to this one, and set `SITE_URL` on the
Convex deployment with `npx convex env set SITE_URL https://<your-app>`.

The forwarder passes the path, query, method, body, and every `Set-Cookie` header through, returns
redirects to the browser instead of following them, and replaces any `x-forwarded-host` the
browser sent with the host it actually used.

## Auth with a hosted provider

For Clerk, WorkOS, Auth0, or another provider that issues its own JWTs, configure the provider in
Convex's `auth.config.ts` as Convex's docs describe, then give `convex()` a `token` reader that
returns the visitor's token for a request:

**farm.config.ts**

```ts
import { createClerkClient } from "@clerk/backend";
import { clerk } from "@farm.js/clerk";
import { convex } from "@farm.js/convex";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default defineConfig({
  integrations: {
    auth: clerk(),
    convex: convex({
      token: async (request) => {
        const state = await clerkClient.authenticateRequest(request);
        return state.isAuthenticated ? state.toAuth().getToken({ template: "convex" }) : undefined;
      },
    }),
  },
});
```

## Choose where a service lives

Convex apps often run auth and billing as Convex components, and Farm has integrations for the
same services. Running both for one service gives you two sources of truth, so Farm checks
`convex/convex.config.ts` against your Farm integrations at startup. When a service is set up on
both sides, `farm dev` and `farm build` stop with an error that names the `home` option.

| Convex component                                               | Farm integration                               | Result   |
| -------------------------------------------------------------- | ---------------------------------------------- | -------- |
| `@convex-dev/better-auth`                                      | `betterAuth({ instance: convexBetterAuth() })` | Together |
| `@convex-dev/workos-authkit`                                   | `workos()`                                     | Together |
| `@convex-dev/better-auth`                                      | Any other auth integration, or `auth: true`    | Conflict |
| `@convex-dev/workos-authkit`                                   | Any other auth integration, or `auth: true`    | Conflict |
| `@convex-dev/polar`, `@convex-dev/stripe`, `@useautumn/convex` | `polar()`, `stripe()`, or `autumn()`           | Conflict |

"Together" pairs are designed to work as one: Farm forwards Better Auth to Convex, and WorkOS
signs users in through Farm while the AuthKit component keeps them in sync in Convex. A service
that lives on one side only, such as Polar as a Convex component with no Farm Polar integration,
needs nothing.

To keep both on purpose, for example while migrating, say which side owns the service:

```ts
convex({ home: { billing: "convex" } });
```

Detection reads the component imports in `convex.config.ts`. If your functions live somewhere
other than `convex/`, pass `functionsDirectory`. When detection cannot tell, the `home` setting
decides.

## Turn off the dev runner

`farm dev` starts `convex dev` for you and marks each line it prints with `convex │`. Until a
deployment is chosen in `.env.local`, Convex keeps the terminal unlabelled so it can ask its setup
questions.

```ts
convex({ dev: false });
```

Pass `dev: { args: ["--tail-logs", "disable"] }` to add arguments to `convex dev`. Turn the runner
off when you already run `npx convex dev` in another terminal.

## Rate limits and KV storage in Convex

`convexRateLimitStorage()` plugs Convex into Farm's [rate limiter](/docs/storage#atomic-rate-limit-storage),
and `convexStorage()` into [KV storage mounts](/docs/storage). Both are backed by a small Convex
component that ships in the package. Convex mutations are atomic, which is what the rate limiter's
`increment` contract needs.

Install the component and expose its functions to Farm:

**convex/convex.config.ts**

```ts
import { defineApp } from "convex/server";
import farm from "@farm.js/convex/convex.config";

const app = defineApp();
app.use(farm);

export default app;
```

**convex/farm.ts**

```ts
import { defineFarmFunctions } from "@farm.js/convex/functions";
import { components } from "./_generated/api";

export const {
  incrementRateLimit,
  readRateLimit,
  getStorageItem,
  listStorageKeys,
  setStorageItem,
  removeStorageItem,
  clearStorageItems,
} = defineFarmFunctions(components.farm);
```

These functions refuse calls that do not carry `FARM_CONVEX_SECRET`. Set the same value in your
Farm server environment and on the deployment:

```bash
npx convex env set FARM_CONVEX_SECRET "$(openssl rand -hex 32)"
```

Then use the adapters:

**src/app/api/middleware.ts**

```ts
import { convexRateLimitStorage } from "@farm.js/convex";
import { middleware } from "@farm.js/core/middleware";

export default middleware().rateLimit({
  requests: 30,
  window: "1m",
  storage: convexRateLimitStorage(),
});
```

**farm.config.ts**

```ts
import { convex, convexStorage } from "@farm.js/convex";

export default defineConfig({
  integrations: { convex: convex() },
  storage: {
    mounts: {
      notes: convexStorage({ namespace: "notes" }),
    },
  },
});
```

| Adapter option | What it does                                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| `secret`       | The shared secret. Defaults to `FARM_CONVEX_SECRET`.                               |
| `module`       | The Convex file that exports the functions. Defaults to `farm` (`convex/farm.ts`). |
| `url`          | The deployment URL. Defaults to the one `convex()` resolved.                       |
| `namespace`    | `convexStorage()` only. Keeps two mounts from sharing keys.                        |

## Environment variables

| Variable             | Where                        | Purpose                                                                              |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `CONVEX_URL`         | Farm (written by Convex CLI) | Deployment URL, ending in `.convex.cloud`. `VITE_CONVEX_URL` also works.             |
| `CONVEX_SITE_URL`    | Farm, optional               | HTTP actions URL, ending in `.convex.site`. Worked out from `CONVEX_URL` when unset. |
| `SITE_URL`           | Convex                       | Your app's URL, for Better Auth's `baseURL`.                                         |
| `FARM_CONVEX_SECRET` | Farm and Convex              | Shared secret for the rate-limit and KV functions.                                   |

On Vercel, `npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name CONVEX_URL` pushes your
functions and builds the app with the production URL in one step.

## Limits

- Farm features that need a SQL database do not work in an app whose only database is Convex. That
  includes plugin [schema tables](/docs/plugins/schema-tables), the [Sync plugin](/docs/plugins/sync),
  and Farm's built-in `auth: true`.
- Server-rendered pages cannot read a [Convex Auth](https://labs.convex.dev/auth) session yet.
  Convex Auth still works in client components.
- A Convex-backed cache adapter (`cache.adapter`) is not part of this package. Farm's page and data
  cache are a better fit for Redis or your platform's cache.
