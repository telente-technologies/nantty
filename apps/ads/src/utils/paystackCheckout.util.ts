export interface PaystackCheckoutSession {
  readonly accessCode: string;
  readonly authorizationUrl: string;
  readonly reference: string;
}

export type PaystackCheckoutOutcome = "completed" | "closed" | "redirected";

export async function openPaystackCheckout(session: PaystackCheckoutSession): Promise<PaystackCheckoutOutcome> {
  const redirectToAuthorizationUrl = (): PaystackCheckoutOutcome => {
    window.location.assign(session.authorizationUrl);
    return "redirected";
  };
  if (!session.accessCode) return redirectToAuthorizationUrl();
  try {
    const { default: PaystackPop } = await import("@paystack/inline-js");
    return await new Promise<PaystackCheckoutOutcome>((resolve) => {
      new PaystackPop().resumeTransaction(session.accessCode, {
        onSuccess: () => resolve("completed"),
        onCancel: () => resolve("closed"),
        onError: () => resolve(redirectToAuthorizationUrl()),
      });
    });
  } catch {
    return redirectToAuthorizationUrl();
  }
}
