import type { ChildProcess } from "node:child_process";
import type { ReactNode } from "react";

import type {
  FarmIntegrationLogger,
  FarmIntegrationProviderComponentReference,
  FarmIntegrationRouteMethod,
} from "@farm.js/core";

export type ConvexTokenReader = (
  request: Request,
) => Promise<string | null | undefined> | string | null | undefined;

export type ConvexService = "auth" | "billing";

export type ConvexServiceSide = "convex" | "farm";

export type ConvexHomes = Partial<Record<ConvexService, ConvexServiceSide>>;

export type ConvexPairRelation = "conflict" | "together";

export interface ConvexDevOptions {
  args?: readonly string[];
}

export interface ConvexIntegrationInput {
  url?: string;
  siteURL?: string;
  provider?: FarmIntegrationProviderComponentReference;
  dev?: boolean | ConvexDevOptions;
  token?: ConvexTokenReader;
  home?: ConvexHomes;
  functionsDirectory?: string;
  log?: FarmIntegrationLogger;
  use?: readonly ConvexExtension[];
}

/** A route on the app's own domain that Farm forwards to the Convex site URL. */
export interface ConvexExtensionRoute {
  /** Farm route pattern, such as "/api/auth/[...auth]" or "/api/webhooks/polar". */
  path: string;
  /** Methods to forward. Defaults to GET and POST. */
  methods?: readonly FarmIntegrationRouteMethod[];
  /** Path on the Convex site URL. Defaults to the incoming path. */
  to?: string;
}

/** A service that lives in Convex, such as auth or billing, wired into Farm by convex({ use }). */
export interface ConvexExtension {
  name: string;
  /** The service Convex owns through this extension. Only one extension can own each service. */
  owns?: ConvexService;
  /** The Convex component it needs in convex.config.ts, such as "@convex-dev/polar". */
  component?: string;
  routes?: readonly ConvexExtensionRoute[];
  /** Reads the visitor's Convex token on the server. Only one extension can set it. */
  token?: ConvexTokenReader;
  /** Browser provider used instead of the default one. Only one extension can set it. */
  provider?: FarmIntegrationProviderComponentReference;
}

export interface ConvexDeploymentURLs {
  url: string;
  siteURL: string;
}

export interface ConvexRuntime extends ConvexDeploymentURLs {
  token?: ConvexTokenReader;
}

export interface ConvexProviderProps {
  url: string;
  children?: ReactNode;
}

export interface ConvexServerOptions {
  request?: Request;
  token?: string;
}

export interface ConvexPair {
  service: ConvexService;
  component: string;
  integration: string;
  relation: ConvexPairRelation;
}

export interface ConvexServiceSetup {
  service: ConvexService;
  side: ConvexServiceSide;
  name: string;
}

export interface ConvexHomeConflict {
  service: ConvexService;
  component: string;
  integration: string;
}

export interface ConvexFarmConfigView {
  root?: string;
  auth?: unknown;
  integrations?: Record<string, ConvexIntegrationView | undefined>;
}

export interface ConvexIntegrationView {
  type?: string;
}

export interface ConvexDevState {
  child?: ChildProcess;
}

/** Options for component(): what Farm should do for a Convex component. */
export interface ConvexComponentOptions extends Omit<
  ConvexExtension,
  "name" | "component" | "routes"
> {
  /** Shown in errors and warnings. Defaults to the component's package name. */
  name?: string;
  /** Paths on your domain forwarded to Convex: { "/api/webhooks/resend": "/resend-webhook" }. */
  routes?: Readonly<Record<string, string>> | readonly ConvexExtensionRoute[];
}

/** Options for a service whose webhooks Farm can receive on your own domain. */
export interface ConvexWebhookOptions {
  /** Path on your domain that receives the service's webhooks and forwards them to Convex. */
  webhooks?: string;
  /** The webhook path the component registers in convex/http.ts, if you changed its default. */
  convexPath?: string;
}

export interface ConvexWebhookService {
  name: string;
  component: string;
  owns?: ConvexService;
  defaultConvexPath: string;
}

export interface ConvexAdapterOptions {
  url?: string;
  secret?: string;
  module?: string;
}

export interface ConvexStorageOptions extends ConvexAdapterOptions {
  namespace?: string;
}

export interface ConvexAdapterCaller {
  query<Result>(name: string, args: Record<string, unknown>): Promise<Result>;
  mutation<Result>(name: string, args: Record<string, unknown>): Promise<Result>;
}

export interface ConvexRuntimeHolder {
  __farmConvexRuntime?: ConvexRuntime;
}

export interface ForwardRequestInit extends RequestInit {
  duplex: "half";
}

export interface ConvexPluginInput {
  dev: ConvexDevOptions | undefined;
  homes: ConvexHomes;
  functionsDirectory: string;
  extensions: readonly ConvexExtension[];
}

export interface ConvexKeyPrefixer {
  addPrefix(key: string): string;
  removePrefix(key: string): string;
}
