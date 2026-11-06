package creators

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestSpaceCoinDonationPolicyLedgerAndIdempotency(t *testing.T) {
	harness := startCreatorsHarness(t)
	host, sender, lowBalanceSender := uuid.NewString(), uuid.NewString(), uuid.NewString()
	spaceID, disabledSpaceID := uuid.NewString(), uuid.NewString()
	harness.makeCreator(host, "starter")
	harness.issueCoins(sender, 200)
	harness.issueCoins(lowBalanceSender, 10)
	harness.module.Container.Settings.SpaceDonationMinimumCoins = 5
	harness.module.Container.Settings.SpaceDonationMaximumCoins = 80
	harness.module.Container.Settings.Revenue.CoinTransferFeeBps = 200

	liveSchema := "space_donation_test_" + uuid.NewString()[:8]
	harness.module.Container.Settings.LiveSchema = liveSchema
	if _, err := harness.database.Exec(`CREATE SCHEMA ` + pgx.Identifier{liveSchema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.database.Exec(`CREATE TABLE ` + pgx.Identifier{liveSchema, "spaces"}.Sanitize() + ` (id uuid PRIMARY KEY, host_id uuid NOT NULL, state text NOT NULL, gifts_enabled boolean NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	for _, row := range []struct {
		id      string
		enabled bool
	}{{spaceID, true}, {disabledSpaceID, false}} {
		if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "spaces"}.Sanitize()+` (id, host_id, state, gifts_enabled) VALUES ($1, $2, 'live', $3)`, row.id, host, row.enabled); err != nil {
			t.Fatal(err)
		}
	}

	request := &moneyv1.DonateSpaceCoinsRequest{SenderUserId: sender, SpaceId: spaceID, Coins: 51, IdempotencyKey: "donation-attempt-01"}
	if _, err := harness.client.DonateSpaceCoins(t.Context(), request); status.Code(err) != codes.Unauthenticated {
		t.Fatalf("unauthenticated donation should be rejected, got %v", err)
	}
	for _, amount := range []int64{0, 4, 81, 1 << 62} {
		invalid := *request
		invalid.Coins = amount
		_, err := harness.client.DonateSpaceCoins(harness.authorized(), &invalid)
		if status.Code(err) != codes.InvalidArgument {
			t.Fatalf("coins=%d must be rejected by server policy, got %v", amount, err)
		}
		foundBounds := false
		if grpcStatus, ok := status.FromError(err); ok {
			for _, detail := range grpcStatus.Details() {
				if info, ok := detail.(*errdetails.ErrorInfo); ok && info.GetReason() == "INVALID_DONATION_AMOUNT" && info.GetMetadata()["minimumCoins"] == "5" && info.GetMetadata()["maximumCoins"] == "80" {
					foundBounds = true
				}
			}
		}
		if !foundBounds {
			t.Fatalf("coins=%d error should expose the configured donation policy, got %v", amount, err)
		}
	}

	first, err := harness.client.DonateSpaceCoins(harness.authorized(), request)
	if err != nil {
		t.Fatal(err)
	}
	if first.GetTotalCoins() != 51 || first.GetCreatorAmountCoins() != 50 || first.GetPlatformFeeCoins() != 1 || first.GetSenderCoinBalance() != 149 || first.GetHostUserId() != host {
		t.Fatalf("unexpected donation receipt: %+v", first)
	}
	replay, err := harness.client.DonateSpaceCoins(harness.authorized(), request)
	if err != nil || !replay.GetReplayed() || replay.GetDonationId() != first.GetDonationId() {
		t.Fatalf("same-key replay should return original donation, receipt=%+v error=%v", replay, err)
	}
	changed := *request
	changed.Coins = 52
	if _, err := harness.client.DonateSpaceCoins(harness.authorized(), &changed); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("same key with changed amount must be rejected, got %v", err)
	}

	self := &moneyv1.DonateSpaceCoinsRequest{SenderUserId: host, SpaceId: spaceID, Coins: 10, IdempotencyKey: "donation-self-01"}
	if _, err := harness.client.DonateSpaceCoins(harness.authorized(), self); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("host cannot donate to themselves, got %v", err)
	}
	disabled := &moneyv1.DonateSpaceCoinsRequest{SenderUserId: sender, SpaceId: disabledSpaceID, Coins: 10, IdempotencyKey: "donation-disabled-01"}
	if _, err := harness.client.DonateSpaceCoins(harness.authorized(), disabled); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("disabled Space must refuse donations, got %v", err)
	}
	insufficient := &moneyv1.DonateSpaceCoinsRequest{SenderUserId: lowBalanceSender, SpaceId: spaceID, Coins: 11, IdempotencyKey: "donation-lowbalance-01"}
	if _, err := harness.client.DonateSpaceCoins(harness.authorized(), insufficient); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("insufficient balance must refuse donation, got %v", err)
	}

	if harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)) != 149 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)) != 50 || harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()) != 1 {
		t.Fatalf("donation balances incorrect: sender=%d host=%d platform=%d", harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)), harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)), harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()))
	}
	var count int
	if err := harness.database.QueryRow(`SELECT count(*) FROM ` + pgx.Identifier{harness.module.Container.Settings.Money.DatabaseSchema, "space_coin_donations"}.Sanitize()).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected exactly one durable donation record, count=%d err=%v", count, err)
	}
	var debits, credits int64
	ledgerSchema := harness.module.Container.Settings.Money.LedgerSchema
	ledgerQuery := `SELECT COALESCE(SUM(CASE WHEN jl.direction = 'debit' THEN jl.amount_minor ELSE 0 END), 0), COALESCE(SUM(CASE WHEN jl.direction = 'credit' THEN jl.amount_minor ELSE 0 END), 0) FROM ` +
		pgx.Identifier{ledgerSchema, "journal_entries"}.Sanitize() + ` je JOIN ` + pgx.Identifier{ledgerSchema, "journal_lines"}.Sanitize() + ` jl ON jl.entry_id = je.id WHERE je.reference = $1`
	if err := harness.database.QueryRow(ledgerQuery, "space-donation:"+spaceID+":"+sender+":"+request.GetIdempotencyKey()).Scan(&debits, &credits); err != nil || debits != 51 || credits != 51 {
		t.Fatalf("donation journal must balance, debits=%d credits=%d err=%v", debits, credits, err)
	}
}
