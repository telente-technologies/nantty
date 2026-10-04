import { AsyncLocalStorage } from "node:async_hooks";

import type { EmailContext } from "../emailTypes";
import { lightPalette, type EmailPalette } from "../theme/emailPalette";

export interface EmailRenderEnvironment {
  readonly palette: EmailPalette;
  readonly context: EmailContext;
}

const emailEnvironmentStorage = new AsyncLocalStorage<EmailRenderEnvironment>();

export function runWithEmailEnvironment<Result>(environment: EmailRenderEnvironment, work: () => Result): Result {
  return emailEnvironmentStorage.run(environment, work);
}

export function useEmailEnvironment(): EmailRenderEnvironment {
  const environment = emailEnvironmentStorage.getStore();
  if (!environment) throw new Error("Email blocks must render inside EmailDocument.");
  return environment;
}

export function useEmailPalette(): EmailPalette {
  return useEmailEnvironment().palette ?? lightPalette;
}

export function classNames(...names: readonly (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
