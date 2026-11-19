package creators_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestBattleCoinContributionIsBoundedEligibleAtomicAndIdempotent(t *testing.T) {
	harness := startCreatorsHarness(t)
	host, recipient, ineligible := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.makeCreator(host, "starter")
	harness.makeCreator(recipient, "starter")
	harness.issueCoins(host, 200)
	harness.module.Container.Settings.Revenue.CoinTransferFeeBps = 200
	harness.module.Container.Settings.BattleContributionMinimumCoins = 5
	harness.module.Container.Settings.BattleContributionMaximumCoins = 100

	liveSchema := "battle_contrib_test_" + uuid.NewString()[:8]
	harness.module.Container.Settings.LiveSchema = liveSchema
	if _, err := harness.database.Exec(`CREATE SCHEMA ` + pgx.Identifier{liveSchema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	for _, ddl := range []string{
		`CREATE TABLE ` + pgx.Identifier{liveSchema, "live_sessions"}.Sanitize() + ` (id uuid PRIMARY KEY, state text NOT NULL)`,
		`CREATE TABLE ` + pgx.Identifier{liveSchema, "battles"}.Sanitize() + ` (id uuid PRIMARY KEY, live_id uuid NOT NULL, host_id uuid NOT NULL, state text NOT NULL, starts_at timestamptz, ends_at timestamptz)`,
		`CREATE TABLE ` + pgx.Identifier{liveSchema, "battle_participants"}.Sanitize() + ` (battle_id uuid NOT NULL, user_id uuid NOT NULL, state text NOT NULL)`,
	} {
		if _, err := harness.database.Exec(ddl); err != nil {
			t.Fatal(err)
		}
	}
	liveID, battleID := uuid.New(), uuid.New()
	now := time.Now().UTC()
	if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "live_sessions"}.Sanitize()+` (id,state) VALUES ($1,'live')`, liveID); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "battles"}.Sanitize()+` (id,live_id,host_id,state,starts_at,ends_at) VALUES ($1,$2,$3,'active',$4,$5)`, battleID, liveID, host, now.Add(-time.Minute), now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	for _, userID := range []string{host, recipient} {
		if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "battle_participants"}.Sanitize()+` (battle_id,user_id,state) VALUES ($1,$2,'active')`, battleID, userID); err != nil {
			t.Fatal(err)
		}
	}
	request := &moneyv1.ContributeBattleCoinsRequest{SenderUserId: host, RecipientUserId: recipient, BattleId: battleID.String(), Coins: 101, IdempotencyKey: "battle-coin-attempt-01"}
	if _, err := harness.client.ContributeBattleCoins(harness.authorized(), request); status.Code(err) != codes.InvalidArgument {
		t.Fatalf("amount above configured bound must fail, got %v", err)
	}
	request.Coins = 100
	first, err := harness.client.ContributeBattleCoins(harness.authorized(), request)
	if err != nil {
		t.Fatal(err)
	}
	if first.GetTotalCoins() != 100 || first.GetPlatformFeeCoins() != 2 || first.GetHoldingCoins() != 98 || first.GetSenderCoinBalance() != 100 || first.GetLiveId() != liveID.String() {
		t.Fatalf("unexpected contribution receipt: %+v", first)
	}
	replay, err := harness.client.ContributeBattleCoins(harness.authorized(), request)
	if err != nil || !replay.GetReplayed() || replay.GetContributionId() != first.GetContributionId() {
		t.Fatalf("retry must replay the original charge: receipt=%+v error=%v", replay, err)
	}
	changed := proto.Clone(request).(*moneyv1.ContributeBattleCoinsRequest)
	changed.Coins = 99
	if _, err := harness.client.ContributeBattleCoins(harness.authorized(), changed); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("reusing a key with a changed amount must fail, got %v", err)
	}
	self := proto.Clone(request).(*moneyv1.ContributeBattleCoinsRequest)
	self.RecipientUserId = host
	self.IdempotencyKey = "battle-coin-self-0001"
	if _, err := harness.client.ContributeBattleCoins(harness.authorized(), self); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("sender cannot contribute to self, got %v", err)
	}
	inactive := proto.Clone(request).(*moneyv1.ContributeBattleCoinsRequest)
	inactive.RecipientUserId = ineligible
	inactive.IdempotencyKey = "battle-coin-inactive-01"
	if _, err := harness.client.ContributeBattleCoins(harness.authorized(), inactive); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("recipient outside active battle must be rejected, got %v", err)
	}
	if got := harness.balance(ledgermodels.UserSpendableCoinsAccount(host)); got != 100 {
		t.Fatalf("sender should be debited exactly once, balance=%d", got)
	}
	if got := harness.balance(ledgermodels.BattleHoldingCoinsAccount(battleID.String(), recipient)); got != 98 {
		t.Fatalf("settlement-compatible participant holding=%d, want 98", got)
	}
	if got := harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()); got != 2 {
		t.Fatalf("platform fee balance=%d, want 2", got)
	}
	var records int
	if err := harness.database.QueryRow(`SELECT count(*) FROM ` + pgx.Identifier{harness.module.Container.Settings.Money.DatabaseSchema, "live_battle_coin_contributions"}.Sanitize()).Scan(&records); err != nil || records != 1 {
		t.Fatalf("expected one audited contribution row, count=%d err=%v", records, err)
	}
}
