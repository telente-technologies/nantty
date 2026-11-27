package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/container"
)

type CreatorEarningsTransfers struct {
	Container *container.Container
	Holds     MonetisationHolds
}

type CreatorEarningsTransferReport struct {
	Transferred int `json:"transferred"`
	Skipped     int `json:"skipped"`
	Failed      int `json:"failed"`
}

var errCreatorProgramMembershipRequired = errors.New("creator program membership is not approved")

func (transfers CreatorEarningsTransfers) TransferCreatorEarningsToConnectedAccounts(ctx context.Context, runId string) CreatorEarningsTransferReport {
	report := CreatorEarningsTransferReport{}
	database := transfers.Container.Resources.Database
	for currency, minimum := range transfers.Container.Settings.CreatorTransferMinimum {
		balances, err := transfers.Container.Ledger.ListBalancesOfAccountsWithCodePrefix(ctx, database, "creator:", currency)
		if err != nil {
			transfers.Container.Resources.Logger.WarnContext(ctx, "could not list creator earnings", slog.Any("error", err))
			report.Failed++
			continue
		}
		for _, balance := range balances {
			if !strings.HasSuffix(balance.Code, ledgermodels.CreatorEarningsPayableAccountCodeSuffix()) || balance.BalanceMinor < minimum {
				continue
			}
			userId := strings.TrimSuffix(strings.TrimPrefix(balance.Code, "creator:"), ledgermodels.CreatorEarningsPayableAccountCodeSuffix())
			approvedCreator, err := transfers.Container.IsApprovedCreator(ctx, database, userId)
			if err != nil || !approvedCreator {
				report.Skipped++
				continue
			}
			if paused, err := transfers.Holds.IsMonetisationPaused(ctx, database, userId); err != nil || paused {
				report.Skipped++
				continue
			}
			if transfers.Container.Payments.RequirePayoutAccountVerified(ctx, userId) != nil || transfers.Container.Payments.RequireVerificationLevel(ctx, userId, paymentmodels.VerificationLevelPayout) != nil {
				report.Skipped++
				continue
			}
			if err := transfers.moveEarningsToWithdrawable(ctx, userId, currency, balance.BalanceMinor, CreatorEarningsMoveReference(userId, currency, balance.CreditsTotalMinor)); err != nil {
				if errors.Is(err, errCreatorProgramMembershipRequired) {
					report.Skipped++
					continue
				}
				transfers.Container.Resources.Logger.WarnContext(ctx, "creator earnings move failed", slog.String("userId", userId), slog.Any("error", err))
				report.Failed++
				continue
			}
			report.Transferred++
		}
	}
	return report
}

func (transfers CreatorEarningsTransfers) moveEarningsToWithdrawable(ctx context.Context, userId, currency string, amountMinor int64, reference string) error {
	return databases.RunInMoneyTransaction(ctx, transfers.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return transfers.payEarningsIntoProviderWallet(ctx, transaction, userId, currency, amountMinor, reference)
	})
}

func (transfers CreatorEarningsTransfers) HandleTransferSucceeded(context.Context, *sql.Tx, paymentmodels.FinishedTransfer) error {
	return nil
}

func (transfers CreatorEarningsTransfers) HandleTransferFailed(context.Context, *sql.Tx, paymentmodels.FinishedTransfer) error {
	return nil
}

func (transfers CreatorEarningsTransfers) payEarningsIntoProviderWallet(ctx context.Context, transaction *sql.Tx, userId, currency string, amountMinor int64, reference string) error {
	approved, err := transfers.Container.IsApprovedCreator(ctx, transaction, userId)
	if err != nil {
		return err
	}
	if !approved {
		return errCreatorProgramMembershipRequired
	}
	inFlight, err := transfers.Container.Payments.HasOpenMovement(ctx, transaction, paymentmodels.MovementCreatorPayout, userId)
	if err != nil || inFlight {
		return err
	}
	if _, err := transfers.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: paymentmodels.MovementCreatorPayout, SubjectId: reference, UserId: userId, ToUserId: userId, AmountMinor: amountMinor, Currency: currency,
	}); err != nil {
		return err
	}
	return transfers.Container.Outbox.EnqueueInTransaction(ctx, transaction, "creatorEarnings.transferred", userId, transfers.Container.Now().UTC(), map[string]any{
		"userId": userId, "reference": reference, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency},
	})
}

func CreatorEarningsMoveReference(userId, currency string, creditsTotalMinor int64) string {
	return fmt.Sprintf("creator-earnings-%s-%s-%d", userId, currency, creditsTotalMinor)
}
