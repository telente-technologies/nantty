package services

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/sellingeligibility"
)

func (gateway *PaymentGateway) ReadSellingEligibility(ctx context.Context, sellerUserId string) (sellingeligibility.Eligibility, error) {
	verifyUrl := gateway.Container.Settings.OnboardingRefreshUrl
	if over, err := gateway.sellerDebtOverLimit(ctx, sellerUserId); err != nil {
		return sellingeligibility.Eligibility{}, err
	} else if over {
		return sellingeligibility.Eligibility{VerifyUrl: verifyUrl, BlockedBy: sellingeligibility.BlockedByDebt, Reason: "Seller debt is above the limit."}, nil
	}
	view, err := gateway.ReadVerificationLevel(ctx, sellerUserId)
	if err != nil {
		return sellingeligibility.Eligibility{}, err
	}
	eligibility := sellingeligibility.Eligibility{Country: view.Country, Level: view.Level, VerifyUrl: verifyUrl, CanSell: true}
	if !gateway.Container.Settings.Wallets.UsesProviderWallets(view.Country) && view.Level < models.VerificationLevelPayout {
		eligibility.CanSell, eligibility.Reason = false, "Outside Nigeria, sellers must verify their identity and payout account before selling."
	}
	return eligibility, nil
}

func (gateway *PaymentGateway) RequireSellerMaySell(ctx context.Context, sellerUserId string) error {
	eligibility, err := gateway.ReadSellingEligibility(ctx, sellerUserId)
	if err != nil {
		return ErrVerificationUnavailable
	}
	return sellingeligibility.RefusalFor(eligibility)
}

func (gateway *PaymentGateway) sellerDebtOverLimit(ctx context.Context, sellerUserId string) (bool, error) {
	owed, err := gateway.readSellerDebts(ctx, sellerUserId)
	if err != nil || len(owed) == 0 {
		return false, err
	}
	view, err := gateway.ReadVerificationLevel(ctx, sellerUserId)
	if err != nil {
		return false, err
	}
	platform := gateway.Container.Resources.Platform
	limits := platform.ReadSellerDebtLimits(ctx, gateway.Container.Settings.SellerDebtLimits)
	trusted := gateway.isTrustedSeller(ctx, sellerUserId, limits.TrustedSellerAgeDays, limits.TrustedSellerCleanDays)
	rates := platform.UsdRatesE8(ctx)
	for currency, amount := range owed {
		if amount > limits.AmountsIn(currency, rates).ForLevel(view.Level, trusted) {
			return true, nil
		}
	}
	return false, nil
}

func (gateway *PaymentGateway) readSellerDebts(ctx context.Context, sellerUserId string) (map[string]int64, error) {
	rows, err := gateway.Container.Resources.Database.QueryContext(ctx, `SELECT currency, COALESCE(SUM(balance_minor), 0) FROM `+pgx.Identifier{gateway.Container.Settings.Money.LedgerSchema, "ledger_accounts"}.Sanitize()+
		` WHERE code IN ($1, $2) AND balance_minor > 0 GROUP BY currency`, ledgermodels.SellerDebtAccount(sellerUserId, "").Code, ledgermodels.WalletDebtAccount(sellerUserId, "").Code)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	owed := map[string]int64{}
	for rows.Next() {
		var currency string
		var amount int64
		if err := rows.Scan(&currency, &amount); err != nil {
			return nil, err
		}
		owed[currency] = amount
	}
	return owed, rows.Err()
}

func (gateway *PaymentGateway) isTrustedSeller(ctx context.Context, sellerUserId string, ageDays, cleanDays int) bool {
	if ageDays <= 0 {
		return false
	}
	now := gateway.Container.Now().UTC()
	database, settings := gateway.Container.Resources.Database, gateway.Container.Settings
	var createdAt time.Time
	accounts := pgx.Identifier{settings.AccountDirectorySchema, "accounts"}.Sanitize()
	if err := database.QueryRowContext(ctx, `SELECT created_at FROM `+accounts+` WHERE id::text = $1`, sellerUserId).Scan(&createdAt); err != nil || createdAt.After(now.AddDate(0, 0, -ageDays)) {
		return false
	}
	since := now.AddDate(0, 0, -cleanDays)
	escrows, disputes, events := pgx.Identifier{settings.EscrowSchema, "escrows"}.Sanitize(), pgx.Identifier{settings.EscrowSchema, "disputes"}.Sanitize(), pgx.Identifier{settings.EscrowSchema, "escrow_events"}.Sanitize()
	var blemishes int
	err := database.QueryRowContext(ctx, `SELECT
		(SELECT count(*) FROM `+disputes+` d JOIN `+escrows+` e ON e.id = d.escrow_id WHERE e.seller_user_id = $1 AND d.status = 'resolved_refunded' AND d.resolved_at >= $2) +
		(SELECT count(*) FROM `+events+` v JOIN `+escrows+` e ON e.id = v.escrow_id WHERE e.seller_user_id = $1 AND v.event_type = 'chargeback_lost' AND v.created_at >= $2)`,
		sellerUserId, since).Scan(&blemishes)
	return err == nil && blemishes == 0
}
