"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";

import { BrandDealsCard } from "@/components/earnings/brandDealsCard";
import { EarningsHistoryCard, RevenueRulesCard, WithdrawalsCard } from "@/components/earnings/earningsHistoryCard";
import { PayoutOnboardingPanel } from "@/components/payouts/payoutOnboardingPanel";
import { WalletVerificationBanner, ZudomartBalanceCard } from "@/components/payouts/zudomartBalanceCard";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted, PageHeader, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import { walletService } from "@/services/wallet.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export default function EarningsPage() {
  const fees = useQuery({ queryKey: ["payout-fees"], queryFn: payoutOnboardingService.fetchPayoutFees });
  const wallet = useQuery({ queryKey: ["wallet", "me"], queryFn: walletService.fetchMine });
  const canWithdraw = Boolean(wallet.data && wallet.data.available.amountMinor > 0 && wallet.data.verification?.withdrawalsUnlocked !== false);
  return (
    <div className={pageStyles.page}>
      <PageHeader
        title="Earnings"
        subtitle="One Zudomart wallet holds everything you earn. Verify your payout details once, then withdraw available money to your bank."
        action={canWithdraw ? <a className={pageStyles.textLink} href={webappLinks.withdraw} target="_blank" rel="noopener noreferrer">Withdraw {formatMoneyForDisplay(wallet.data!.available)}</a> : null}
      />
      <WalletVerificationBanner summary={wallet.data} payoutSetupHref="#payout-setup" />
      <ZudomartBalanceCard wallet={wallet} />
      <Card title="Payout details" id="payout-setup">
        <Suspense fallback={<Skeleton height={120} />}>
          <PayoutOnboardingPanel />
        </Suspense>
        {fees.data ? (
          <Muted>{`Withdrawal fee: ${formatMoneyForDisplay(fees.data.fee)} flat, added on top of the amount. ${fees.data.arrivalEstimate} ${fees.data.firstPayoutNote}`}</Muted>
        ) : fees.isError ? (
          <ErrorState title="Withdrawal fee didn't load" description={readErrorMessageForDisplay(fees.error)} onRetry={() => void fees.refetch()} />
        ) : null}
      </Card>
      <div className={pageStyles.columns}>
        <EarningsHistoryCard />
        <WithdrawalsCard />
      </div>
      <RevenueRulesCard />
      <BrandDealsCard currency={wallet.data?.available.currency ?? "NGN"} />
    </div>
  );
}
