import { unprocessable } from "../../../errors/domain.error.js";

export class PaymentReturnUrls {
  public constructor(private readonly allowedReturnUrls: readonly string[]) {}

  public buildReturnUrlForReference(reference: string, requestedReturnTo: string | undefined): string {
    const returnTo = requestedReturnTo?.trim() ?? this.allowedReturnUrls[0];
    if (returnTo === undefined || !this.allowedReturnUrls.includes(returnTo)) throw unprocessable("This return address is not allowed.");
    const url = new URL(returnTo);
    url.searchParams.set("reference", reference);
    return url.toString();
  }
}
