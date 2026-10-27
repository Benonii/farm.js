# @farm.js/convex

[Convex](https://convex.dev) integration for Farm.js. It wraps the app in a Convex provider, gives
server-rendered pages a per-request Convex client, starts `convex dev` with `farm dev`, forwards
Better Auth running in Convex through your own domain, and backs Farm's rate-limit and KV storage
slots with Convex.

## Install

```bash
pnpm add @farm.js/convex convex
```

## Configure

```ts
import { defineConfig } from "@farm.js/core";
import { convex } from "@farm.js/convex";

export default defineConfig({
  integrations: {
    convex: convex(),
  },
});
```

`convex()` reads `CONVEX_URL` (or `VITE_CONVEX_URL`), which `npx convex dev` writes to
`.env.local`, and works out `CONVEX_SITE_URL` from it.

## Load data on the server

```tsx
import { preloadQuery } from "@farm.js/convex/server";
import { api } from "../../convex/_generated/api";
import { Messages } from "./messages";

export default async function HomePage() {
  const messages = await preloadQuery(api.messages.list);
  return <Messages preloaded={messages} />;
}
```

Pages that preload Convex data are kept out of Farm's shared page cache.

## Auth and billing in Convex

```ts
import { convex } from "@farm.js/convex";
import { betterAuth } from "@farm.js/convex/better-auth";
import { polar } from "@farm.js/convex/polar";

convex({ use: [betterAuth(), polar({ webhooks: "/api/webhooks/polar" })] });
```

Extensions wire services that live in Convex into Farm: routes on your own domain, the visitor's
token, and the browser provider. See the
[Convex integration docs](https://farmjs.dev/docs/integrations/convex) for writing your own
extension, the `home` option, and the rate-limit and KV adapters.
