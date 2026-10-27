import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { betterAuth } from "../better-auth.js";
import { component } from "../component.js";
import { convex } from "../index.js";
import { autumn } from "../autumn.js";
import { polar } from "../polar.js";
import { resend } from "../resend.js";
import { stripe } from "../stripe.js";
import { workosAuthKit } from "../workos.js";
import { readConvexRuntime } from "../runtime.js";
import { startRecordingServer } from "./recording-server.js";

import type { ConvexExtension } from "../types.js";
import type { RecordingServer } from "./types.js";

const url = "https://happy-otter-123.convex.cloud";

describe("convex({ use })", () => {
  it("mounts Better Auth on the app's domain, reads its token, and wraps the app in its provider", () => {
    const integration = convex({ url, dev: false, use: [betterAuth()] });
    expect(integration.routes?.map((route) => [route.path, route.methods])).toEqual([
      ["/api/auth/[...auth]", ["GET", "POST"]],
    ]);
    expect(integration.providers?.[0]?.component).toEqual({
      module: "@farm.js/convex/better-auth/client",
      export: "ConvexBetterAuthProvider",
    });
    expect(readConvexRuntime()?.token).toBeTypeOf("function");
  });

  it("lets the app's own token reader and provider win over an extension's", () => {
    const token = () => "app-token";
    const provider = { module: "@/lib/provider", export: "AppProvider" };
    const integration = convex({ url, dev: false, token, provider, use: [betterAuth()] });
    expect(readConvexRuntime()?.token).toBe(token);
    expect(integration.providers?.[0]?.component).toEqual(provider);
  });

  it("adds no Polar route unless the app gives a webhook path", () => {
    expect(convex({ url, dev: false, use: [polar()] }).routes ?? []).toEqual([]);
    const routes = convex({
      url,
      dev: false,
      use: [polar({ webhooks: "/api/webhooks/polar" })],
    }).routes;
    expect(routes?.map((route) => [route.path, route.methods])).toEqual([
      ["/api/webhooks/polar", ["POST"]],
    ]);
  });

  it("refuses two extensions that own the same service", () => {
    const other: ConvexExtension = { name: "other-auth", owns: "auth" };
    expect(() => convex({ url, dev: false, use: [betterAuth(), other] })).toThrow(
      /better-auth and other-auth both own auth/,
    );
  });

  it("refuses two extensions that both set a token reader", () => {
    const first: ConvexExtension = { name: "first", token: () => "a" };
    const second: ConvexExtension = { name: "second", token: () => "b" };
    expect(() => convex({ url, dev: false, use: [first, second] })).toThrow(
      /first and second both set a token/,
    );
  });

  it("refuses route paths that are not absolute or are taken twice", () => {
    const relative: ConvexExtension = { name: "relative", routes: [{ path: "api/hooks" }] };
    expect(() => convex({ url, dev: false, use: [relative] })).toThrow(/starting with "\/"/);
    const first: ConvexExtension = { name: "first", routes: [{ path: "/api/hooks" }] };
    const second: ConvexExtension = { name: "second", routes: [{ path: "/api/hooks" }] };
    expect(() => convex({ url, dev: false, use: [first, second] })).toThrow(
      /first and second both route \/api\/hooks/,
    );
  });
});

describe("extension routes", () => {
  let convexSite: RecordingServer;

  beforeAll(async () => {
    convexSite = await startRecordingServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
    });
  });

  afterAll(() => convexSite.close());

  it("forwards a Polar webhook from the app's domain to the component's Convex path", async () => {
    const integration = convex({
      url,
      siteURL: convexSite.url,
      dev: false,
      use: [polar({ webhooks: "/api/webhooks/polar" })],
    });
    const route = integration.routes?.[0];
    const request = new Request("https://app.example.com/api/webhooks/polar", {
      method: "POST",
      body: '{"type":"subscription.created"}',
    });
    const response = await route?.handler(request, {} as never);
    expect(response?.status).toBe(200);
    expect(convexSite.requests.at(-1)?.url).toBe("/polar/events");
    expect(convexSite.requests.at(-1)?.body).toBe('{"type":"subscription.created"}');
  });
});

describe("component()", () => {
  it("turns a path map into routes forwarded to the component's Convex paths", () => {
    const resend = component("@convex-dev/resend", {
      routes: { "/api/webhooks/resend": "/resend-webhook" },
    });
    expect(resend).toEqual({
      name: "@convex-dev/resend",
      component: "@convex-dev/resend",
      routes: [{ path: "/api/webhooks/resend", to: "/resend-webhook" }],
    });
    const routes = convex({ url, dev: false, use: [resend] }).routes;
    expect(routes?.map((route) => [route.path, route.methods])).toEqual([
      ["/api/webhooks/resend", ["GET", "POST"]],
    ]);
  });

  it("passes ownership, a name, full routes, and a token reader through", () => {
    const token = () => "token";
    const stripe = component("@convex-dev/stripe", {
      name: "stripe",
      owns: "billing",
      token,
      routes: [{ path: "/api/webhooks/stripe", methods: ["POST"], to: "/stripe/webhook" }],
    });
    expect(stripe).toMatchObject({
      name: "stripe",
      owns: "billing",
      component: "@convex-dev/stripe",
      token,
    });
    expect(() => convex({ url, dev: false, use: [polar(), stripe] })).toThrow(
      /polar and stripe both own billing/,
    );
  });

  it("needs a package name", () => {
    expect(() => component(" ")).toThrow(/package name/);
  });
});

describe("service helpers", () => {
  it.each([
    ["polar", polar, "@convex-dev/polar", "billing", "/polar/events"],
    ["stripe", stripe, "@convex-dev/stripe", "billing", "/stripe/webhook"],
    ["resend", resend, "@convex-dev/resend", undefined, "/resend-webhook"],
    ["workosAuthKit", workosAuthKit, "@convex-dev/workos-authkit", "auth", "/workos/webhook"],
  ] as const)(
    "%s forwards webhooks to the component's default path",
    (name, helper, pkg, owns, to) => {
      expect(helper()).toMatchObject({ name, component: pkg, owns, routes: [] });
      expect(helper({ webhooks: "/api/webhooks/x" }).routes).toEqual([
        { path: "/api/webhooks/x", methods: ["POST"], to },
      ]);
      expect(helper({ webhooks: "/api/webhooks/x", convexPath: "/custom" }).routes?.[0]?.to).toBe(
        "/custom",
      );
    },
  );

  it("autumn marks billing as Convex-owned with nothing to forward", () => {
    expect(autumn()).toEqual({
      name: "autumn",
      owns: "billing",
      component: "@useautumn/convex",
      routes: [],
    });
  });
});
