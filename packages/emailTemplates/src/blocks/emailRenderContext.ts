import { createContext, useContext } from "react";

import type { EmailContext } from "../emailTypes";
import { lightPalette, type EmailPalette } from "../theme/emailPalette";

export interface EmailRenderEnvironment {
  readonly palette: EmailPalette;
  readonly context: EmailContext;
}

export const EmailRenderContext = createContext<EmailRenderEnvironment | null>(null);

export function useEmailEnvironment(): EmailRenderEnvironment {
  const environment = useContext(EmailRenderContext);
  if (!environment) throw new Error("Email blocks must render inside EmailDocument.");
  return environment;
}

export function useEmailPalette(): EmailPalette {
  return useEmailEnvironment().palette ?? lightPalette;
}

export function classNames(...names: readonly (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
