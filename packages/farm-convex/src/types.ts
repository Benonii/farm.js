import type { ChildProcess } from "node:child_process";
import type { ReactNode } from "react";

import type {
  FarmIntegrationLogger,
  FarmIntegrationProviderComponentReference,
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
  instance?: unknown;
}

export interface ConvexDevState {
  child?: ChildProcess;
}

export interface ConvexBetterAuthOptions {
  siteURL?: string;
}

export interface ConvexBetterAuthInstance {
  readonly kind: "convex-better-auth";
  handler(request: Request): Promise<Response>;
  token(request: Request): Promise<string | undefined>;
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
}

export interface ConvexKeyPrefixer {
  addPrefix(key: string): string;
  removePrefix(key: string): string;
}
