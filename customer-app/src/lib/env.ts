// App environment, driven by the build profile's `EXPO_PUBLIC_APP_ENV`
// (inlined at build time). Used for the Testing-Environment indicator and to
// keep non-production builds visibly distinct. Values: "development" (local),
// "staging" (internal testing APK → staging backend), "production".
import { API_BASE } from "./api";

export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "development").toLowerCase();

export const IS_PRODUCTION = APP_ENV === "production";
/** Any non-production build: show the testing indicator so a tester always
 *  knows this is not the live app. */
export const IS_TESTING = !IS_PRODUCTION;

/** Short, loud label for the on-screen indicator. */
export const ENV_LABEL = APP_ENV === "staging" ? "TESTING" : APP_ENV.toUpperCase();

/** Host of the backend this build talks to, for the indicator (no scheme). */
export const API_HOST = API_BASE.replace(/^https?:\/\//, "").replace(/\/$/, "");
