package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent/coinpurchase"
	"zudomart/modules/wallet/src/generated/ent/cointransfer"
	"zudomart/modules/wallet/src/generated/ent/walletriskflag"
)

const (
	RuleOpenWalletRiskFlag    = "open_wallet_risk_flag"
	RuleChargebackHistory     = "chargeback_history"
	RuleStoreRefundHistory    = "store_refund_history"
	RuleCoinPurchaseVelocity  = "coin_purchase_velocity"
	RuleTransferBurst         = "transfer_burst"
	RuleTransferFanOut        = "transfer_fan_out"
	RuleStoreRefundAfterSpend = "store_refund_after_coins_spent"
	purchaseVelocityLimit     = 5
	transferBurstLimit        = 10
	transferFanOutLimit       = 10
)

type CoinRiskRules struct {
	Container *container.Container
}

func (rules CoinRiskRules) FlagsForPurchase(ctx context.Context, transaction *sql.Tx, userId string, purchaseId uuid.UUID) ([]string, error) {
	flags, err := rules.accountHistoryFlags(ctx, transaction, userId)
	if err != nil {
		return nil, err
	}
	recent, err := rules.Container.Client(transaction).CoinPurchase.Query().Where(coinpurchase.UserID(userId), coinpurchase.IDNEQ(purchaseId),
		coinpurchase.StatusIn(coinpurchase.StatusSucceeded, coinpurchase.StatusRefunded), coinpurchase.CreditedAtGT(rules.Container.Now().Add(-24*time.Hour))).Count(ctx)
	if err != nil {
		return nil, err
	}
	if recent >= purchaseVelocityLimit {
		flags = append(flags, RuleCoinPurchaseVelocity)
	}
	return flags, nil
}

func (rules CoinRiskRules) FlagsForTransfer(ctx context.Context, transaction *sql.Tx, senderUserId, recipientUserId string) ([]string, error) {
	flags, err := rules.accountHistoryFlags(ctx, transaction, senderUserId, recipientUserId)
	if err != nil {
		return nil, err
	}
	client, now := rules.Container.Client(transaction), rules.Container.Now()
	burst, err := client.CoinTransfer.Query().Where(cointransfer.SenderUserID(senderUserId), cointransfer.CreatedAtGT(now.Add(-time.Hour))).Count(ctx)
	if err != nil {
		return nil, err
	}
	if burst >= transferBurstLimit {
		flags = append(flags, RuleTransferBurst)
	}
	recipients, err := client.CoinTransfer.Query().Where(cointransfer.SenderUserID(senderUserId), cointransfer.CreatedAtGT(now.Add(-24*time.Hour))).
		Unique(true).Select(cointransfer.FieldRecipientUserID).Strings(ctx)
	if err != nil {
		return nil, err
	}
	if len(recipients) >= transferFanOutLimit {
		flags = append(flags, RuleTransferFanOut)
	}
	return flags, nil
}

func (rules CoinRiskRules) accountHistoryFlags(ctx context.Context, transaction *sql.Tx, userIds ...string) ([]string, error) {
	client := rules.Container.Client(transaction)
	flags := []string{}
	open, err := client.WalletRiskFlag.Query().Where(walletriskflag.UserIDIn(userIds...), walletriskflag.ResolvedAtIsNil()).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if open {
		flags = append(flags, RuleOpenWalletRiskFlag)
	}
	refunded, err := client.CoinPurchase.Query().Where(coinpurchase.UserIDIn(userIds...), coinpurchase.StatusEQ(coinpurchase.StatusRefunded), coinpurchase.ChannelEQ(coinpurchase.ChannelStoreIap)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if refunded {
		flags = append(flags, RuleStoreRefundHistory)
	}
	for _, userId := range userIds {
		chargedBack, err := rules.Container.Payments.UserHasChargebackHistory(ctx, transaction, userId)
		if err != nil {
			return nil, err
		}
		if chargedBack {
			flags = append(flags, RuleChargebackHistory)
			break
		}
	}
	return flags, nil
}

func ReviewStateForPurchaseFlags(flags []string) coinpurchase.ReviewStatus {
	if len(flags) > 0 {
		return coinpurchase.ReviewStatusPendingReview
	}
	return coinpurchase.ReviewStatusNotRequired
}

func ReviewStateForTransferFlags(flags []string) cointransfer.ReviewStatus {
	if len(flags) > 0 {
		return cointransfer.ReviewStatusPendingReview
	}
	return cointransfer.ReviewStatusNotRequired
}
