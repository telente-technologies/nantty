"use client";

import { buildButtonClassName } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";

import { useAdsVerification } from "./adsVerificationProvider";

export function VerificationPrompt({ message }: { readonly message?: string | null }) {
  const verification = useAdsVerification();
  return (
    <InlineNotice
      tone="caution"
      title="Verify to advertise"
      action={
        <a href={verification.verifyUrl} className={buildButtonClassName("primary", "small")} target="_blank" rel="noopener noreferrer">
          Get paid setup
        </a>
      }
    >
      {message || verification.message} It takes about 5 minutes. Come back here when you&apos;re done.
    </InlineNotice>
  );
}

export function VerificationBanner() {
  const { needsVerification } = useAdsVerification();
  return needsVerification ? (
    <div style={{ marginBottom: 16 }}>
      <VerificationPrompt />
    </div>
  ) : null;
}
