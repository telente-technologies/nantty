"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import styles from "@/components/escrow/escrow.module.css";
import { Button } from "@/components/ui/button";
import { readErrorMessageForDisplay, sendRequestToWebappServer } from "@/services/clientApi.service";
import { providerWalletQueryKeys, providerWalletService } from "@/services/providerWallet.service";
import { readHostedCheckoutUrl } from "@/utils/hostedCheckout.util";
import { presentPaymentProblem, readPaymentProblemCode } from "@/utils/paymentProblem.util";

interface BankValidationState {
  readonly status: "not_started" | "pending" | "verified" | "failed" | string;
  readonly consentUrl?: string;
  readonly reference?: string;
}

const consentHosts = ["flutterwave.com", "nibss-plc.com.ng"];
const validationQueryKey = ["payouts", "bank-validation"] as const;

function isTrustedConsentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && consentHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return readHostedCheckoutUrl({ checkoutUrl: url, reference: "" }, window.location.origin) !== null;
  }
}

export function BvnConsentCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const levelQuery = useQuery({ queryKey: providerWalletQueryKeys.verification, queryFn: providerWalletService.fetchMyVerificationLevel, retry: false });
  const isNigeria = levelQuery.data?.country === "NG";
  const validation = useQuery({
    queryKey: validationQueryKey,
    queryFn: () => sendRequestToWebappServer<BankValidationState>("/api/v1/payments/payout-onboarding/me/bank-validation"),
    enabled: isNigeria,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "pending" && query.state.dataUpdateCount < 40 ? 3_000 : false),
  });
  const start = useMutation({
    mutationFn: () => sendRequestToWebappServer<BankValidationState>("/api/v1/payments/payout-onboarding/me/bank-validation", {
      method: "POST",
      query: { returnTo: `${window.location.origin}/wallet/payouts` },
    }),
    onSuccess: async (started) => {
      if (started.consentUrl && isTrustedConsentUrl(started.consentUrl)) {
        window.location.assign(started.consentUrl);
        return;
      }
      queryClient.setQueryData(validationQueryKey, started);
      await queryClient.invalidateQueries({ queryKey: providerWalletQueryKeys.verification });
    },
    onError: (error) => void presentPaymentProblem(error, (href) => router.push(href)),
  });

  if (!isNigeria || !validation.data || validation.data.status === "verified") return null;
  const status = validation.data.status;
  return (
    <section className={styles.notice} aria-labelledby="bvn-consent-title">
      <h2 id="bvn-consent-title" className={styles.noticeTitle}>{status === "pending" ? "Waiting for your BVN confirmation" : "Confirm your bank details with your BVN"}</h2>
      <p className={styles.muted}>
        {status === "failed"
          ? "We couldn't match your BVN with your payout details. Check that your legal name and bank account are in your own name, then try again."
          : "In Nigeria, your wallet and payouts are opened in your name with our licensed payment partner. You'll confirm on a secure page that we can check your BVN name. We never see your bank login."}
      </p>
      {status === "pending" ? <p className={styles.muted} role="status">We&apos;re checking with your bank. This page updates on its own.</p> : null}
      <div>
        <Button busy={start.isPending} disabled={start.isSuccess && status === "pending"} onClick={() => start.mutate()}>
          {status === "pending" ? "Open the confirmation page again" : status === "failed" ? "Try again" : "Confirm with BVN"}
        </Button>
      </div>
      {start.isError && !readPaymentProblemCode(start.error) ? <p className={styles.muted} role="alert">{readErrorMessageForDisplay(start.error)}</p> : null}
    </section>
  );
}
