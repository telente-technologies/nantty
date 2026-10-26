package creators

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	moneyv1 "nantty/contracts/gen/go/zudomart/money/v1"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestSpaceCoinGiftUsesServerCatalogHostOnlyAndIdempotentBalancedLedger(t *testing.T) {
	harness := startCreatorsHarness(t)
	host, sender, nonCreator := uuid.NewString(), uuid.NewString(), uuid.NewString()
	spaceID, nonCreatorSpaceID, disabledSpaceID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	liveSchema := "space_gift_test_" + uuid.NewString()[:8]
	harness.module.Container.Settings.LiveSchema = liveSchema
	harness.makeCreator(host, "starter")
	harness.issueCoins(sender, 100)
	if _, err := harness.database.Exec(`CREATE SCHEMA ` + pgx.Identifier{liveSchema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.database.Exec(`CREATE TABLE ` + pgx.Identifier{liveSchema, "gifts"}.Sanitize() + ` (id text PRIMARY KEY, price_coins bigint NOT NULL, is_active boolean NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.database.Exec(`CREATE TABLE ` + pgx.Identifier{liveSchema, "spaces"}.Sanitize() + ` (id uuid PRIMARY KEY, host_id uuid NOT NULL, state text NOT NULL, gifts_enabled boolean NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	for _, row := range []struct {
		id, host string
		enabled  bool
	}{{spaceID, host, true}, {nonCreatorSpaceID, nonCreator, true}, {disabledSpaceID, host, false}} {
		if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "spaces"}.Sanitize()+` (id, host_id, state, gifts_enabled) VALUES ($1, $2, 'live', $3)`, row.id, row.host, row.enabled); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := harness.database.Exec(`INSERT INTO ` + pgx.Identifier{liveSchema, "gifts"}.Sanitize() + ` (id, price_coins, is_active) VALUES ('gift_static', 10, true), ('gift_disabled', 10, false)`); err != nil {
		t.Fatal(err)
	}
	request := &moneyv1.ChargeSpaceCoinGiftRequest{
		SenderUserId: sender, SpaceId: spaceID, GiftId: "gift_static", Quantity: 2, IdempotencyKey: "space-gift-key-01",
	}
	if _, err := harness.client.ChargeSpaceCoinGift(t.Context(), request); status.Code(err) != codes.Unauthenticated {
		t.Fatalf("unauthenticated request should be rejected, got %v", err)
	}
	first, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), request)
	if err != nil {
		t.Fatal(err)
	}
	if first.GetTotalCoins() != 20 || first.GetUnitPriceCoins() != 10 || first.GetCreatorAmountCoins() != 10 || first.GetPlatformFeeCoins() != 10 || first.GetSenderCoinBalance() != 80 {
		t.Fatalf("unexpected server-priced gift receipt: %+v", first)
	}
	if first.GetHostUserId() != host || first.GetSenderUserId() != sender || first.GetSpaceId() != request.GetSpaceId() {
		t.Fatalf("gift receipt recipient/source mismatch: %+v", first)
	}
	replay, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), request)
	if err != nil || !replay.GetReplayed() || replay.GetGiftTransactionId() != first.GetGiftTransactionId() {
		t.Fatalf("expected the original receipt on replay, receipt=%+v error=%v", replay, err)
	}
	changed := *request
	changed.Quantity = 3
	if _, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), &changed); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("same key with changed request should be rejected, got %v", err)
	}
	selfGift := *request
	selfGift.SenderUserId, selfGift.IdempotencyKey = host, "space-gift-self-01"
	if _, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), &selfGift); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("host must not gift themselves, got %v", err)
	}
	nonCreatorGift := *request
	nonCreatorGift.SpaceId, nonCreatorGift.IdempotencyKey = nonCreatorSpaceID, "space-gift-noncreator-01"
	if _, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), &nonCreatorGift); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("non-creator host must not receive coin gifts, got %v", err)
	}
	disabledGift := *request
	disabledGift.GiftId, disabledGift.IdempotencyKey = "gift_disabled", "space-gift-disabled-01"
	if _, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), &disabledGift); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("inactive server catalog gift must be refused, got %v", err)
	}
	spaceDisabledGift := *request
	spaceDisabledGift.SpaceId, spaceDisabledGift.IdempotencyKey = disabledSpaceID, "space-gift-feature-off-01"
	if _, err := harness.client.ChargeSpaceCoinGift(harness.authorized(), &spaceDisabledGift); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("Space gifts_enabled flag must be enforced by money service, got %v", err)
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)) != 80 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)) != 10 || harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()) != 10 {
		t.Fatalf("coin gift balances are incorrect: sender=%d host=%d platform=%d",
			harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)),
			harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)),
			harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()))
	}
	var giftRows int
	schema := harness.module.Container.Settings.Money.DatabaseSchema
	if err := harness.database.QueryRow(`SELECT count(*) FROM "` + schema + `".space_coin_gifts`).Scan(&giftRows); err != nil || giftRows != 1 {
		t.Fatalf("expected exactly one durable gift row, count=%d err=%v", giftRows, err)
	}
	var debits, credits int64
	ledgerSchema := harness.module.Container.Settings.Money.LedgerSchema
	ledgerQuery := `SELECT COALESCE(SUM(CASE WHEN jl.direction = 'debit' THEN jl.amount_minor ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN jl.direction = 'credit' THEN jl.amount_minor ELSE 0 END), 0) FROM ` +
		pgx.Identifier{ledgerSchema, "journal_entries"}.Sanitize() + ` je JOIN ` +
		pgx.Identifier{ledgerSchema, "journal_lines"}.Sanitize() + ` jl ON jl.entry_id = je.id WHERE je.reference = $1`
	if err := harness.database.QueryRow(ledgerQuery, "space-gift:"+spaceID+":"+sender+":space-gift-key-01").Scan(&debits, &credits); err != nil || debits != 20 || credits != 20 {
		t.Fatalf("space coin gift journal should balance, debits=%d credits=%d err=%v", debits, credits, err)
	}
}
