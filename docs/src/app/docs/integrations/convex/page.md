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
```

Register the integration (below) and run `farm dev`. On a new app with no deployment yet, Farm
starts `convex dev`, which creates one and writes `CONVEX_URL` to `.env.local`; Farm then asks you
to restart `farm dev` to connect. In a project that depends on Vite, Convex writes
`VITE_CONVEX_URL` instead; Farm reads either name. For a free local deployment with no Convex
account, set `CONVEX_AGENT_MODE=anonymous`.

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

`convex()` does five things:

- Checks `CONVEX_URL` and `CONVEX_SITE_URL` at startup. In `farm build` and production, a missing
  URL, or a `.convex.site` URL where the `.convex.cloud` one belongs, fails with an error that
  names the fix. When `CONVEX_SITE_URL` is not set, Farm works it out from `CONVEX_URL`.
- Wraps every route in a Convex provider, so `useQuery`, `useMutation`, and `useAction` from
  `convex/react` work in client components. Only the public deployment URL reaches the browser.
- Starts `convex dev` when `farm dev` starts, and stops it when Farm stops. It never runs during
  `farm build` or in production.
- Reads `convex/convex.config.ts` and turns on the helper for each component it knows, such as
  Better Auth or Stripe. See [Services that live in Convex](#services-that-live-in-convex).
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
in your own provider, pass a component reference:

**farm.config.ts**

```ts
convex({
  provider: { module: "@/components/AppConvexProvider", export: "AppConvexProvider" },
});
```

The component receives the deployment URL as `url`. Use `readConvexReactClient(url)` from
`@farm.js/convex/client` to get the shared client instead of constructing a second one. A
`provider` you pass here wins over one that an [extension](#services-that-live-in-convex) supplies.

## Services that live in Convex

Convex apps often run auth, billing, and email inside Convex as components. `convex()` reads the
components installed in `convex/convex.config.ts` and turns on a helper for each one it knows, so
nothing else is registered in Farm. With `@convex-dev/better-auth` installed, this is the whole
config:

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

To change a helper's options, list it in `use`. An entry in `use` replaces the detected helper for
the same component, and `detect: false` turns detection off:

```ts
import { betterAuth, convex, stripe } from "@farm.js/convex";

convex({ use: [stripe({ webhooks: true })] }); // Better Auth is still detected
convex({ detect: false, use: [betterAuth()] }); // only what is listed
```

A service whose `home` is `"farm"` is never detected. Every helper is exported from
`@farm.js/convex` and from its own path, such as `@farm.js/convex/stripe`.

| Extension                                         | Convex component             | What Farm adds                                                               |
| ------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `betterAuth()` from `@farm.js/convex/better-auth` | `@convex-dev/better-auth`    | `/api/auth/*` on your domain, the visitor's token, the browser provider      |
| `polar()` from `@farm.js/convex/polar`            | `@convex-dev/polar`          | Billing; optional webhook route forwarded to `/polar/events`                 |
| `stripe()` from `@farm.js/convex/stripe`          | `@convex-dev/stripe`         | Billing; optional webhook route forwarded to `/stripe/webhook`               |
| `autumn()` from `@farm.js/convex/autumn`          | `@useautumn/convex`          | Billing                                                                      |
| `resend()` from `@farm.js/convex/resend`          | `@convex-dev/resend`         | Optional webhook route forwarded to `/resend-webhook`                        |
| `workosAuthKit()` from `@farm.js/convex/workos`   | `@convex-dev/workos-authkit` | Optional webhook route forwarded to `/workos/webhook`; works with `workos()` |
| `component(name, options)` from `@farm.js/convex` | Any component                | Whatever you pass: routes, ownership, token, provider                        |

Every helper with a webhook takes the same two options: `webhooks`, the path on your domain to
give the provider's dashboard (`true` uses `/api/webhooks/<service>`), and `convexPath`, if you
registered the component's route somewhere other than its default:

```ts
convex({
  use: [
    stripe({ webhooks: true }), // https://<your-app>/api/webhooks/stripe
    resend({ webhooks: "/hooks/email" }),
  ],
});
```

The body and signature headers reach Convex unchanged, so each component verifies its webhooks as
usual. Without `webhooks`, point the provider at your `.convex.site` URL directly.

Each service can have only one owner. Two extensions that own the same service, or an extension
next to a Farm integration for the same service, stop `farm dev` and `farm build` with an error.
When an extension's component is missing from `convex.config.ts`, Farm prints a warning.

### Auth with Better Auth running in Convex

When `@convex-dev/better-auth` is in `convex.config.ts`, `convex()` turns on `betterAuth()`. It
forwards `/api/auth/*` to the component on your Convex site URL. Sign-in happens on your own domain, so session cookies are first-party and
server-rendered pages know who is signed in. The extension also exchanges the visitor's session
cookie for a Convex token, so `preloadQuery` and the other server helpers run as the signed-in
user, and wraps the app in `ConvexBetterAuthProvider` so live queries do too. Visitors without a
session cookie cost no network call.

Do not register `@farm.js/better-auth` or set `auth: true` as well: Convex owns auth here.

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

In the browser, sign in with the auth client from `@farm.js/convex/better-auth/client`. It calls
your own domain:

**src/components/SignInForm.tsx**

```tsx
"use client";

import { authClient } from "@farm.js/convex/better-auth/client";

export function SignInButton() {
  return (
    <button onClick={() => authClient.signIn.email({ email: "ada@example.com", password: "..." })}>
      Sign in
    </button>
  );
}
```

To use Better Auth client plugins of your own, create your client with
`createAuthClient({ plugins: [convexClient(), ...] })` and pass a [`provider`](#choose-client-ownership)
that wraps the app in `ConvexBetterAuthProvider` with it.

Because sign-in goes through your domain, OAuth providers call back to
`https://<your-app>/api/auth/callback/<provider>`. Update the callback URL in each provider's
console when you move an app from the cross-domain setup to this one, and set `SITE_URL` on the
Convex deployment with `npx convex env set SITE_URL https://<your-app>`.

The forwarder passes the path, query, method, body, and every `Set-Cookie` header through, returns
redirects to the browser instead of following them, and replaces any `x-forwarded-host` the
browser sent with the host it actually used.

### Billing with Polar running in Convex

With `@convex-dev/polar`, checkout, the customer portal, and subscription data all live in Convex,
and you call them from Convex functions. Farm has nothing to mount unless you want Polar's webhooks
on your own domain. `polar({ webhooks })` forwards that path to the route the component registers
with `polar.registerRoutes(http)`:

```ts
convex({ use: [polar({ webhooks: "/api/webhooks/polar" })] });
```

Then use `https://<your-app>/api/webhooks/polar` as the webhook URL in Polar. The body and
signature headers reach Convex unchanged, so the component verifies them as usual. If you
registered the component's routes on a custom path, pass it as `convexPath`. Without `webhooks`,
point Pol### Add any other Convex component

For a component without a helper above, `component()` wires it into Farm without writing an
extension. Name its package,
then map paths on your domain to the routes the component registers in `convex/http.ts`:

```ts
import { betterAuth, component, convex } from "@farm.js/convex";

convex({
  use: [
    betterAuth(),
    component("@convex-dev/resend", {
      routes: { "/api/webhooks/resend": "/resend-webhook" },
    }),
    component("@convex-dev/rate-limiter"),
  ],
});
```

Farm warns at startup when a listed component is missing from `convex.config.ts`, and forwards
each route's method, query, headers, and body unchanged. The component's own settings, such as
products, API keys, or schedules, stay in your `convex/` code and `npx convex env set`, because
that code runs on Convex.

| Option     | Use                                                                                    |
| ---------- | -------------------------------------------------------------------------------------- |
| `routes`   | `{ "/path/on/your/domain": "/path/on/convex" }`, or full route objects with `methods`. |
| `name`     | Shown in errors and warnings. Defaults to the package name.                            |
| `token`    | Reads the visitor's Convex token on the server. The component then counts as auth.     |
| `provider` | A browser provider used instead of the default one.                                    |

### Write your own extension

`component()` returns a plain extension object. To publish a reusable one, such as `polar()`,
return the object yourself:

```ts
import type { ConvexExtension } from "@farm.js/convex";

export function resend(): ConvexExtension {
  return {
    name: "resend",
    component: "@convex-dev/resend",
    routes: [{ path: "/api/webhooks/resend", methods: ["POST"], to: "/resend-webhook" }],
  };
}
```

| Field       | Use                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `name`      | Shown in errors and warnings.                                                                                           |
| `service`   | `"auth"` or `"billing"`, for the check that the service is not also set up in Farm. A `token` or `provider` means auth. |
| `component` | The component it needs in `convex.config.ts`. Farm warns when it is missing.                                            |
| `routes`    | Paths on your domain forwarded to the Convex site URL. `to` sets the Convex path.                                       |
| `token`     | Reads the visitor's Convex token on the server. Only one extension can set it.                                          |
| `provider`  | A browser provider used instead of the default one. Only one extension can set it.                                      |

A `token` or `provider` passed to `convex()` directly wins over an extension's.

fault one. Only one extension can set it. |

A `token` or `provider` passed to `convex()` directly wins over an extension's.

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

Running a service both in Convex and in Farm gives you two sources of truth. Besides the extensions
in `use`, Farm reads the component imports in `convex/convex.config.ts` and compares them with your
Farm integrations at startup. When a service is set up on both sides, `farm dev` and `farm build`
stop with an error that names the `home` option.

| In Convex                                                      | In Farm                                     | Result   |
| -------------------------------------------------------------- | ------------------------------------------- | -------- |
| `@convex-dev/workos-authkit`                                   | `workos()`                                  | Together |
| `@convex-dev/better-auth` or `use: [betterAuth()]`             | Any auth integration, or `auth: true`       | Conflict |
| `@convex-dev/workos-authkit`                                   | Any other auth integration, or `auth: true` | Conflict |
| `@convex-dev/polar`, `@convex-dev/stripe`, `@useautumn/convex` | `polar()`, `stripe()`, or `autumn()`        | Conflict |

WorkOS is designed to run on both sides: it signs users in through Farm while the AuthKit
component keeps them in sync in Convex. A service that lives on one side only, such as Polar as a
Convex component with no Farm Polar integration, needs nothing.

To keep both on purpose, for example while migrating, say which side owns the service:

```ts
convex({ home: { billing: "convex" } });
```

If your functions live somewhere other than `convex/`, pass `functionsDirectory`.

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

## Deploy

`farm build` only builds the app. It never pushes Convex functions, so a local or CI build can't
change your production backend. Use `convex deploy` as the build command instead:

```bash
npx convex deploy --cmd 'pnpm build' --cmd-url-env-var-name CONVEX_URL
```

It pushes your functions, then builds the app against the same deployment, so the site never ships
pointing at an older backend. It needs `CONVEX_DEPLOY_KEY` in the build environment. On Vercel, set
this as the project's build command.

`convex deploy` sets `CONVEX_URL` only while the build runs. The Farm server reads it again when it
starts, so also set `CONVEX_URL` in your host's runtime environment.

## Limits

- Farm features that need a SQL database do not work in an app whose only database is Convex. That
  includes plugin [schema tables](/docs/plugins/schema-tables), the [Sync plugin](/docs/plugins/sync),
  and Farm's built-in `auth: true`.
- Server-rendered pages cannot read a [Convex Auth](https://labs.convex.dev/auth) session yet.
  Convex Auth still works in client components.
- A Convex-backed cache adapter (`cache.adapter`) is not part of this package. Farm's page and data
  cache are a better fit for Redis or your platform's cache.
