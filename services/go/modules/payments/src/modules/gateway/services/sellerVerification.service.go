package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/ledger/src/databases"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/orderpayable"
	"zudomart/modules/payments/src/generated/ent/sellerverification"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrSellerSalesCapReached         = httpserver.NewApiError(http.StatusConflict, "SELLER_SALES_CAP_REACHED", "This store has reached its sales limit while the seller's business verification is pending, so it can't take this order right now.")
	ErrSellerVerificationRequired    = httpserver.NewApiError(http.StatusForbidden, "SELLER_VERIFICATION_REQUIRED", "Finish business verification to withdraw your sales earnings.")
	ErrSellerVerificationUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "SELLER_VERIFICATION_UNAVAILABLE", "We couldn't confirm the seller's verification. Try again in a moment.")
)

func (gateway *PaymentGateway) IsSellerVerified(ctx context.Context, executor databases.ExecutorQuerier, accountId string) (bool, error) {
	recorded, err := gateway.Container.Client(executor).SellerVerification.Query().Where(sellerverification.AccountID(accountId)).Only(ctx)
	if err == nil {
		return recorded.RevokedAt == nil, nil
	}
	if !ent.IsNotFound(err) {
		return false, err
	}
	schema := gateway.Container.Settings.UsersSchema
	if schema == "" || !ledgerutils.IsUuid(accountId) {
		return false, nil
	}
	query := `SELECT EXISTS (SELECT 1 FROM ` + pgx.Identifier{schema, "profile_checkmarks"}.Sanitize() + ` WHERE account_id = $1::uuid AND color = 'gold' AND status = 'verified')`
	rows, err := executor.QueryContext(ctx, query, accountId)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	verified := false
	if rows.Next() {
		err = rows.Scan(&verified)
	}
	return verified, errors.Join(err, rows.Err())
}

func (gateway *PaymentGateway) RequireSellerVerifiedForWithdrawal(ctx context.Context, userId string) error {
	database := gateway.Container.Resources.Database
	sells, err := gateway.Container.Client(database).OrderPayable.Query().Where(orderpayable.SellerUserID(userId)).Exist(ctx)
	if err != nil {
		return ErrSellerVerificationUnavailable
	}
	if !sells {
		return nil
	}
	verified, err := gateway.IsSellerVerified(ctx, database, userId)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "seller verification read failed; refusing the withdrawal", "userId", userId, "error", err)
		return ErrSellerVerificationUnavailable
	}
	if !verified {
		return ErrSellerVerificationRequired
	}
	return nil
}

type sellerCurrency struct {
	SellerUserId string
	Currency     string
}

func (gateway *PaymentGateway) enforceUnverifiedSellerRulesInTransaction(ctx context.Context, transaction *sql.Tx, newPayables []models.OrderPayable) error {
	totals := map[sellerCurrency]int64{}
	direct := map[string]bool{}
	for _, payable := range newPayables {
		totals[sellerCurrency{payable.SellerUserId, payable.Currency}] += payable.AmountMinor
		direct[payable.SellerUserId] = direct[payable.SellerUserId] || payable.PaymentMode == "direct"
	}
	keys := make([]sellerCurrency, 0, len(totals))
	for key := range totals {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(left, right int) bool {
		return keys[left].SellerUserId+keys[left].Currency < keys[right].SellerUserId+keys[right].Currency
	})
	caps := gateway.Container.Resources.Platform.ReadUnverifiedSellerSalesCaps(ctx, gateway.Container.Settings.UnverifiedSellerSalesCaps)
	for _, key := range keys {
		if gateway.Container.UsesProviderWallets() && key.Currency != walletCurrency {
			continue
		}
		verified, err := gateway.IsSellerVerified(ctx, transaction, key.SellerUserId)
		if err != nil {
			gateway.Container.Resources.Logger.WarnContext(ctx, "seller verification read failed; refusing the checkout", "sellerUserId", key.SellerUserId, "error", err)
			return ErrSellerVerificationUnavailable
		}
		if verified {
			continue
		}
		if direct[key.SellerUserId] {
			return ErrDirectPaymentNotAllowed
		}
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "seller-sales-cap:"+key.SellerUserId+":"+key.Currency); err != nil {
			return err
		}
		used, err := gateway.sumCountedSellerSales(ctx, transaction, key)
		if err != nil {
			return err
		}
		if used+totals[key] > caps[key.Currency] {
			return ErrSellerSalesCapReached
		}
	}
	return nil
}

func (gateway *PaymentGateway) sumCountedSellerSales(ctx context.Context, transaction *sql.Tx, key sellerCurrency) (int64, error) {
	schema := gateway.Container.Settings.Money.DatabaseSchema
	payables, intents := pgx.Identifier{schema, "order_payables"}.Sanitize(), pgx.Identifier{schema, "payment_intents"}.Sanitize()
	query := `SELECT COALESCE(SUM(p.amount_minor), 0) FROM ` + payables + ` p WHERE p.seller_user_id = $1 AND p.currency = $2 AND (
		EXISTS (SELECT 1 FROM ` + intents + ` i WHERE i.subject_id IN (p.checkout_id, p.order_id) AND i.status = 'succeeded')
		OR (p.created_at > $3 AND NOT EXISTS (SELECT 1 FROM ` + intents + ` i WHERE i.subject_id IN (p.checkout_id, p.order_id) AND i.status IN ('failed', 'cancelled'))))`
	window := gateway.Container.Now().Add(-time.Duration(max(gateway.Container.Settings.CheckoutExpiryMinutes, 15)) * time.Minute)
	var used int64
	err := transaction.QueryRowContext(ctx, query, key.SellerUserId, key.Currency, window).Scan(&used)
	return used, err
}
