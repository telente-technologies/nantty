"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/surfaces";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { billingApi } from "@/services/billingApi.service";
import { walletApi } from "@/services/walletApi.service";
import { readAvailableToWithdraw } from "@/utils/zudomartWallet.util";

import { BalanceAndCreditsCard } from "./balanceAndCreditsCard";
import { BillingHistoryTables } from "./billingHistoryTables";
import styles from "./billingPage.module.css";
import { PayFromBalanceDialog } from "./payFromBalanceDialog";
import { PaymentSettingsCard } from "./paymentSettingsCard";
import { TopUpDialog } from "./topUpDialog";
import { ZudomartBalanceCard } from "./zudomartBalanceCard";

export function BillingPage() {
  const { accountId, account, canPerform, reloadAccount } = useAdAccount();
  const overviewQuery = useAdsQuery(() => billingApi.fetchBillingOverview(accountId), accountId);
  const entitlementsQuery = useAdsQuery(() => accountsApi.fetchEntitlements(accountId), accountId);
  const walletQuery = useAdsQuery(() => walletApi.fetchMyWallet(), "wallet-me");
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isPayFromBalanceOpen, setIsPayFromBalanceOpen] = useState(false);
  const availableToWithdraw = readAvailableToWithdraw(walletQuery.data)?.amount ?? null;
  const canManageBilling = canPerform("billing:manage");
  const overview = overviewQuery.data;

  return (
    <>
      <PageHeader title="Billing" description={`Everything on ${account.name} is charged in ${account.currency}.`} />
      {overviewQuery.errorMessage ? <ErrorState message={overviewQuery.errorMessage} onRetry={overviewQuery.reload} /> : null}
      {!overview && overviewQuery.isLoading ? <LoadingBlock height={220} /> : null}
      {overview ? (
        <div className={styles.layout}>
          <BalanceAndCreditsCard overview={overview} entitlements={entitlementsQuery.data} canManageBilling={canManageBilling} onRequestTopUp={() => setIsTopUpOpen(true)} availableToWithdraw={availableToWithdraw} onRequestPayFromBalance={() => setIsPayFromBalanceOpen(true)} />
          <PaymentSettingsCard
            accountId={accountId}
            overview={overview}
            canManageBilling={canManageBilling}
            onOverviewChange={(next) => {
              overviewQuery.replaceData(() => next);
              reloadAccount();
            }}
            onReloadOverview={overviewQuery.reload}
          />
          <div className={styles.fullWidth}>
            <ZudomartBalanceCard walletQuery={walletQuery} />
          </div>
          <div className={`${styles.fullWidth} ${styles.stack}`}>
            <BillingHistoryTables accountId={accountId} />
          </div>
          {isPayFromBalanceOpen && availableToWithdraw ? (
            <PayFromBalanceDialog
              accountId={accountId}
              accountCurrency={overview.balance.currency}
              availableToWithdraw={availableToWithdraw}
              isOpen={isPayFromBalanceOpen}
              onClose={() => setIsPayFromBalanceOpen(false)}
              onPaid={() => {
                overviewQuery.reload();
                walletQuery.reload();
                reloadAccount();
              }}
            />
          ) : null}
          {isTopUpOpen ? <TopUpDialog accountId={accountId} overview={overview} isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} /> : null}
        </div>
      ) : null}
    </>
  );
}
