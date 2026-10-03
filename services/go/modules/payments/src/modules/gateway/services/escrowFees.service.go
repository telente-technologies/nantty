package services

import (
	"context"
	"database/sql"
	"sync"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/utils"
)

type SellerPlanLookup func(ctx context.Context, sellerUserId string) string

var (
	sellerPlanLookupMutex sync.RWMutex
	sellerPlanLookup      SellerPlanLookup
)

func RegisterSellerPlanLookup(lookup SellerPlanLookup) {
	sellerPlanLookupMutex.Lock()
	defer sellerPlanLookupMutex.Unlock()
	sellerPlanLookup = lookup
}

func (gateway *PaymentGateway) EscrowFeeBpsForSeller(ctx context.Context, sellerUserId string) int64 {
	sellerPlanLookupMutex.RLock()
	lookup := sellerPlanLookup
	sellerPlanLookupMutex.RUnlock()
	if lookup != nil && lookup(ctx, sellerUserId) == "business" {
		return gateway.Container.Settings.BusinessEscrowFeeBps
	}
	return gateway.Container.Settings.EscrowFeeBps
}

func EscrowFeeForAmount(amountMinor, feeBps int64) int64 {
	return utils.PlatformFeeForAmount(amountMinor, feeBps)
}

func (gateway *PaymentGateway) RefreshMyPayoutAccount(ctx context.Context, userId string) (ConnectedAccountView, error) {
	account, err := gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return ConnectedAccountView{}, err
	}
	if err := gateway.recomputePayoutAccountStatus(ctx, account.ID); err != nil {
		return ConnectedAccountView{}, err
	}
	account, err = gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return ConnectedAccountView{}, err
	}
	return ConvertConnectedAccountToView(account), nil
}

func (gateway *PaymentGateway) SendVerificationPrompt(ctx context.Context, userId string) error {
	account, err := gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return err
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payoutAccount.actionRequired", account.ID.String(), gateway.Container.Now().UTC(), map[string]any{
			"userId": userId, "payoutAccountId": account.ID.String(), "verificationStatus": string(account.VerificationStatus), "reason": "adminPrompt",
		})
	})
}
