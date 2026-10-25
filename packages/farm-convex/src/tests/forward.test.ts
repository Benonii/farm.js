import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { convexBetterAuth } from "../better-auth.js";
import { startRecordingServer } from "./recording-server.js";

import type { RecordingServer } from "./types.js";

describe("convexBetterAuth handler", () => {
  let convexSite: RecordingServer;

  beforeAll(async () => {
    convexSite = await startRecordingServer((request, response) => {
      if (request.url.startsWith("/api/auth/callback")) {
        response.writeHead(302, { location: "https://app.example.com/account" });
        response.end();
        return;
      }
      response.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": ["session_token=abc; Path=/", "session_data=def; Path=/"],
      });
      response.end(JSON.stringify({ received: request.body }));
    });
  });

  afterAll(() => convexSite.close());

  it("passes the path, query, method and body through to the Convex site", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const request = new Request("https://app.example.com/api/auth/sign-in/email?redirect=%2Fhome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", password: "correct horse" }),
    });
    const response = await auth.handler(request);
    const recorded = convexSite.requests.at(-1);
    expect(recorded?.method).toBe("POST");
    expect(recorded?.url).toBe("/api/auth/sign-in/email?redirect=%2Fhome");
    expect(JSON.parse(recorded?.body ?? "{}")).toEqual({
      email: "ada@example.com",
      password: "correct horse",
    });
    expect(await response.json()).toEqual({ received: recorded?.body });
  });

  it("keeps every Set-Cookie header from Convex", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const response = await auth.handler(
      new Request("https://app.example.com/api/auth/get-session"),
    );
    expect(response.headers.getSetCookie()).toEqual([
      "session_token=abc; Path=/",
      "session_data=def; Path=/",
    ]);
  });

  it("returns redirects to the browser instead of following them", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const response = await auth.handler(
      new Request("https://app.example.com/api/auth/callback/github?code=1"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example.com/account");
  });

  it("tells Better Auth which host the browser used and asks for an uncompressed response", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    await auth.handler(
      new Request("https://app.example.com/api/auth/get-session", {
        headers: { "accept-encoding": "gzip", "x-forwarded-host": "attacker.example.com" },
      }),
    );
    const headers = convexSite.requests.at(-1)?.headers;
    expect(headers?.["x-forwarded-host"]).toBe("app.example.com");
    expect(headers?.["x-better-auth-forwarded-host"]).toBe("app.example.com");
    expect(headers?.["x-better-auth-forwarded-proto"]).toBe("https");
    expect(headers?.host).toBe(new URL(convexSite.url).host);
    expect(headers?.["accept-encoding"]).toBe("identity");
  });
});

describe("convexBetterAuth token", () => {
  let convexSite: RecordingServer;

  beforeAll(async () => {
    convexSite = await startRecordingServer((request, response) => {
      const isSignedIn = request.headers.cookie?.includes("better-auth.session_token=valid");
      response.writeHead(isSignedIn ? 200 : 401, { "content-type": "application/json" });
      response.end(
        JSON.stringify(isSignedIn ? { token: "jwt-for-ada" } : { message: "Unauthorized" }),
      );
    });
  });

  afterAll(() => convexSite.close());

  it("exchanges the session cookie for a Convex token", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const request = new Request("https://app.example.com/", {
      headers: { cookie: "theme=dark; better-auth.session_token=valid" },
    });
    expect(await auth.token(request)).toBe("jwt-for-ada");
    expect(convexSite.requests.at(-1)?.url).toBe("/api/auth/convex/token");
  });

  it("skips the network when the visitor has no session cookie", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const requestCount = convexSite.requests.length;
    expect(await auth.token(new Request("https://app.example.com/"))).toBeUndefined();
    expect(convexSite.requests.length).toBe(requestCount);
  });

  it("returns no token when Convex rejects the session", async () => {
    const auth = convexBetterAuth({ siteURL: convexSite.url });
    const request = new Request("https://app.example.com/", {
      headers: { cookie: "better-auth.session_token=expired" },
    });
    expect(await auth.token(request)).toBeUndefined();
  });
});
