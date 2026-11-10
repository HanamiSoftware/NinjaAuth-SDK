// src/index.ts
export { NinjaAuth } from "./NinjaAuth";
export { completeWebAuthCallback } from "./platform/web/AuthorizationLauncher";

export type {
    NinjaAuthConfig,
	NinjaUser,
	NinjaSession
} from "./types/types";