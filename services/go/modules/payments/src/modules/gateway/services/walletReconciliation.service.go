package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/payouttransfer"
	"nantty/modules/payments/src/generated/ent/providermovement"
	"nantty/modules/payments/src/generated/ent/providerwallet"
	"nantty/modules/payments/src/generated/ent/reconciliationrun"
	"nantty/modules/payments/src/generated/ent/walletfunding"
	"nantty/modules/payments/src/interfaces"
)

type WalletReconciliationReport struct {
	RunId              string   `json:"runId"`
	Status             string   `json:"status"`
	WalletsChecked     int      `json:"walletsChecked"`
	SettlementsApplied int      `json:"settlementsApplied"`
	ReversalsApplied   int      `json:"reversalsApplied"`
	Issues             []string `json:"issues"`
}

func (report *WalletReconciliationReport) flag(opened bool, issue string) {
	report.Issues = append(report.Issues, issue)
}

func (gateway *PaymentGateway) RunDailyWalletReconciliation(ctx context.Context) (WalletReconciliationReport, error) {
	provider, err := gateway.Container.DefaultWallets()
	if err != nil {
		return WalletReconciliationReport{}, err
	}
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	run, err := client.ReconciliationRun.Create().SetProvider(gateway.walletProviderName()).SetKind("daily").SetSummary([]byte("{}")).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return WalletReconciliationReport{}, err
	}
	report := WalletReconciliationReport{RunId: run.ID.String(), Issues: []string{}}
	day := gateway.Container.Now().UTC().Format("2006-01-02")
	report.SettlementsApplied = gateway.ProcessProviderSettlements(ctx, &report)
	report.ReversalsApplied = gateway.applyProviderFundingReversals(ctx, provider, &report)
	gateway.reconcileEveryWallet(ctx, provider, day, &report)
	gateway.reconcileMainBalance(ctx, day, &report)
	gateway.flagStuckMovements(ctx, day, &report)
	report.Status = "clean"
	if len(report.Issues) > 0 {
		report.Status = "drift"
	}
	summary, _ := json.Marshal(report)
	err = run.Update().SetStatus(reconciliationrun.Status(report.Status)).SetWalletsChecked(report.WalletsChecked).SetIssuesFound(len(report.Issues)).
		SetSummary(summary).SetFinishedAt(gateway.Container.Now().UTC()).Exec(ctx)
	return report, err
}

func (gateway *PaymentGateway) reconcileEveryWallet(ctx context.Context, provider interfaces.WalletProvider, day string, report *WalletReconciliationReport) {
	database := gateway.Container.Resources.Database
	wallets, err := gateway.Container.Client(database).ProviderWallet.Query().Where(providerwallet.Provider(gateway.walletProviderName()), providerwallet.StatusNEQ(providerwallet.StatusDeleted)).All(ctx)
	if err != nil {
		report.flag(false, "could not list wallets: "+err.Error())
		return
	}
	tolerance := gateway.Container.Settings.Wallets.ReconciliationDriftTolerance
	for _, wallet := range wallets {
		report.WalletsChecked++
		subject := "wallet " + wallet.AccountRef
		balance, err := provider.ReadWalletBalance(ctx, wallet.AccountRef, wallet.Currency)
		if err != nil {
			if isDefinitiveProviderRejection(err) {
				gateway.FreezeProviderWallet(ctx, wallet.UserID, "the provider no longer recognises this wallet")
				report.flag(gateway.OpenReconciliationCase(ctx, "walletMissingAtProvider", subject, wallet.AccountRef, 0, 0, wallet.Currency, "the wallet is deleted or unknown at the provider"), subject+": missing at provider")
			}
			continue
		}
		mirror, _ := gateway.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.ProviderWalletMirrorAccount(wallet.Provider, wallet.AccountRef, wallet.Currency))
		liabilities, _ := gateway.Container.Ledger.SumBalancesOfAccountsWithCodePrefix(ctx, database, ledgermodels.WalletAccountCodePrefix(wallet.UserID), wallet.Currency)
		locked, _ := gateway.Container.Ledger.SumBalancesOfAccountsWithCodePrefix(ctx, database, ledgermodels.WalletEscrowLockedAccountCodePrefix(wallet.UserID), wallet.Currency)
		debt, _ := gateway.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.WalletDebtAccount(wallet.UserID, wallet.Currency))
		if diff := balance.AvailableMinor - mirror; diff > tolerance || -diff > tolerance {
			gateway.FreezeProviderWallet(ctx, wallet.UserID, "the provider balance differs from the ledger")
			report.flag(gateway.OpenReconciliationCase(ctx, "walletDrift", subject, wallet.AccountRef+":"+day, mirror, balance.AvailableMinor, wallet.Currency, "provider balance differs from the ledger mirror"), subject+": balance drift")
		}
		if mirror != liabilities {
			report.flag(gateway.OpenReconciliationCase(ctx, "walletLedgerMismatch", subject, wallet.AccountRef+":"+day, liabilities, mirror, wallet.Currency, "the ledger mirror differs from the wallet's liabilities"), subject+": ledger mismatch")
		}
		if balance.AvailableMinor < locked {
			report.flag(gateway.OpenReconciliationCase(ctx, "walletBelowLocked", subject, wallet.AccountRef+":"+day, locked, balance.AvailableMinor, wallet.Currency, "the wallet holds less than its locked escrow"), subject+": below locked escrow")
		}
		if debt > 0 {
			report.flag(gateway.OpenReconciliationCase(ctx, "walletDebtOutstanding", subject, wallet.AccountRef+":"+day, 0, debt, wallet.Currency, "the user owes money after a reversal or chargeback"), subject+": debt outstanding")
		}
		gateway.matchWalletStatement(ctx, provider, wallet, day, report)
	}
}

func (gateway *PaymentGateway) matchWalletStatement(ctx context.Context, provider interfaces.WalletProvider, wallet *ent.ProviderWallet, day string, report *WalletReconciliationReport) {
	now := gateway.Container.Now().UTC()
	lines, err := provider.ListWalletTransactions(ctx, wallet.AccountRef, now.AddDate(0, 0, -2), now.AddDate(0, 0, 1))
	if err != nil {
		return
	}
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	for _, line := range lines {
		base := line.Reference
		for _, suffix := range []string{"_FEE", "_REVERSAL"} {
			base = strings.TrimSuffix(base, suffix)
		}
		base = strings.TrimPrefix(base, "REV_")
		known := !strings.Contains(line.Reference, "_RETRY_")
		if known {
			fundings, _ := client.WalletFunding.Query().Where(walletfunding.ProviderReference(base)).Exist(ctx)
			movements, _ := client.ProviderMovement.Query().Where(providermovement.Reference(base)).Exist(ctx)
			payouts, _ := client.PayoutTransfer.Query().Where(payouttransfer.Reference(base)).Exist(ctx)
			known = fundings || movements || payouts || (line.Direction == "credit" && strings.HasPrefix(base, "PSA_"))
		}
		if !known {
			gateway.FreezeProviderWallet(ctx, wallet.UserID, "a wallet statement line has no ledger entry")
			report.flag(gateway.OpenReconciliationCase(ctx, "unknownStatementLine", "wallet "+wallet.AccountRef, wallet.AccountRef+":"+line.Reference, 0, line.AmountMinor, line.Currency,
				fmt.Sprintf("%s line %s has no matching movement", line.Direction, line.Reference)), "unknown statement line "+line.Reference)
		}
	}
}

func (gateway *PaymentGateway) reconcileMainBalance(ctx context.Context, day string, report *WalletReconciliationReport) {
	payouts, err := gateway.Container.DefaultPayouts()
	if err != nil {
		return
	}
	balances, err := payouts.ReadPlatformBalances(ctx)
	if err != nil {
		report.flag(false, "could not read the main balance")
		return
	}
	for _, balance := range balances {
		ledger, err := gateway.Container.Ledger.ReadAccountBalance(ctx, gateway.Container.Resources.Database, ledgermodels.PlatformProviderBalanceAccount(gateway.walletProviderName(), balance.Currency))
		if err != nil || (ledger == 0 && balance.AvailableMinor == 0) {
			continue
		}
		if diff := balance.AvailableMinor - ledger; diff > gateway.Container.Settings.Wallets.ReconciliationDriftTolerance || -diff > gateway.Container.Settings.Wallets.ReconciliationDriftTolerance {
			report.flag(gateway.OpenReconciliationCase(ctx, "mainBalanceDrift", "main "+balance.Currency, balance.Currency+":"+day, ledger, balance.AvailableMinor, balance.Currency, "the main provider balance differs from the ledger"), "main balance drift "+balance.Currency)
		}
	}
}

func (gateway *PaymentGateway) flagStuckMovements(ctx context.Context, day string, report *WalletReconciliationReport) {
	cutoff := gateway.Container.Now().UTC().Add(-gateway.Container.Settings.Wallets.MovementStuckAfter)
	stuck, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.Query().
		Where(providermovement.StatusIn(providermovement.StatusPending, providermovement.StatusProcessing), providermovement.CreatedAtLT(cutoff)).Limit(500).All(ctx)
	if err != nil {
		return
	}
	for _, movement := range stuck {
		report.flag(gateway.OpenReconciliationCase(ctx, "movementStuck", movement.Kind+" "+movement.Reference, movement.Reference+":"+day, movement.AmountMinor, 0, movement.Currency,
			"movement still "+string(movement.Status)+" "+movement.BlockedOn), "stuck movement "+movement.Reference)
	}
}

func (gateway *PaymentGateway) applyProviderFundingReversals(ctx context.Context, provider interfaces.WalletProvider, report *WalletReconciliationReport) int {
	now := gateway.Container.Now().UTC()
	reversals, err := provider.ListFundingReversals(ctx, now.AddDate(0, 0, -7), now.Add(24*time.Hour))
	if err != nil {
		report.Issues = append(report.Issues, "provider funding reversals could not be reconciled")
		return 0
	}
	applied := 0
	for _, reversal := range reversals {
		reference := "PSA_" + strings.TrimPrefix(reversal.FundingReference, "PSA_")
		if reversal.Outcome == interfaces.OutcomeFailed {
			if err := gateway.ReleasePendingFundingReversal(ctx, reference); err != nil {
				report.Issues = append(report.Issues, "failed provider reversal could not be reopened for review")
			}
			continue
		}
		if reversal.Outcome != interfaces.OutcomeSucceeded {
			continue
		}
		reversed, err := gateway.Container.Client(gateway.Container.Resources.Database).WalletFunding.Query().Where(walletfunding.ProviderReference(reference), walletfunding.ReversedAtNotNil()).Exist(ctx)
		if err != nil || reversed {
			continue
		}
		if err := gateway.ApplyFundingReversal(ctx, reference, reversal.ProviderReversalReference, "reversed by the sending bank"); err == nil {
			applied++
			report.Issues = append(report.Issues, "funding reversed "+reference)
		}
	}
	return applied
}
