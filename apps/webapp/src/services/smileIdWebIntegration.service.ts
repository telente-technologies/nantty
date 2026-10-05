import type { IdentityCaptureSession } from "@/types/identityVerification.type";

const smileIdScriptUrl = "https://cdn.smileidentity.com/inline/v10/js/script.min.js";

interface SmileIdentityOptions {
  readonly token: string;
  readonly product: string;
  readonly callback_url: string;
  readonly environment: "sandbox" | "live";
  readonly partner_details: { readonly partner_id: string; readonly name: string; readonly policy_url: string; readonly theme_color: string };
  readonly onSuccess: () => void;
  readonly onClose: () => void;
  readonly onError: (error: unknown) => void;
}

declare global {
  interface Window {
    SmileIdentity?: (options: SmileIdentityOptions) => void;
  }
}

function loadSmileIdScript(): Promise<void> {
  if (window.SmileIdentity) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = smileIdScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The identity check could not load. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

export async function openSmileIdCapture(session: IdentityCaptureSession, policyUrl: string): Promise<"submitted" | "closed"> {
  await loadSmileIdScript();
  return new Promise((resolve, reject) => {
    window.SmileIdentity?.({
      token: session.token ?? "", product: session.product, callback_url: session.callbackUrl, environment: session.environment === "production" ? "live" : "sandbox",
      partner_details: { partner_id: session.partnerId, name: "Zudomart", policy_url: policyUrl, theme_color: "#3B5BFD" },
      onSuccess: () => resolve("submitted"), onClose: () => resolve("closed"), onError: (error) => reject(error instanceof Error ? error : new Error("The identity check failed to start.")),
    });
  });
}
