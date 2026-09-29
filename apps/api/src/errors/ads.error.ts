import { HttpError } from "@zudojs/errors";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function adsError(statusCode: number, code: string, message: string): HttpError {
  return new HttpError(message, { statusCode, code, expose: true });
}

export class AdsValidationFailure extends Error {
  public constructor(public readonly issues: readonly ValidationIssue[]) {
    super(issues[0]?.message ?? "Validation failed");
    this.name = "AdsValidationFailure";
  }
}

export function throwIfValidationIssues(issues: readonly ValidationIssue[]): void {
  if (issues.length > 0) throw new AdsValidationFailure(issues);
}

export const adAccountNotFound = () => adsError(404, "AD_ACCOUNT_NOT_FOUND", "Ad account was not found.");
export const adsNotFound = (what: string) => adsError(404, "NOT_FOUND", `${what} was not found.`);
export const adsForbidden = () => adsError(403, "FORBIDDEN", "Your role on this ad account does not allow this.");
export const adsConflict = (code: string, message: string) => adsError(409, code, message);
