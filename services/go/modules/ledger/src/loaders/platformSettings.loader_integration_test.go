package loaders_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	"zudomart/modules/ledger/src/loaders"
)

func TestPlatformSettingsAreReadFromTheAdminSchemaCachedAndFallBackToTheEnvironment(t *testing.T) {
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	adminSchema := moneytesting.CreateEmptySchema(t, database, "admin")
	table := pgx.Identifier{adminSchema, "platform_settings"}.Sanitize()
	if _, err := database.Exec(`CREATE TABLE ` + table + ` (key text PRIMARY KEY, value jsonb NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	source := loaders.NewPlatformSettingsSource(database, adminSchema, time.Hour, slog.New(slog.NewTextHandler(io.Discard, nil)))
	fallback := loaders.EscrowPolicy{AutoReleasePeriod: 72 * time.Hour, SellerCreditHoldPeriod: 24 * time.Hour}
	ctx := context.Background()

	if policy := source.ReadEscrowPolicy(ctx, fallback); policy != fallback {
		t.Fatalf("a missing setting must use the environment fallback, got %+v", policy)
	}
	if _, err := database.Exec(`INSERT INTO ` + table + ` VALUES ('escrow.policy', '{"autoReleaseDays":5,"sellerCreditHoldHours":12,"sellerReserveBps":300}')`); err != nil {
		t.Fatal(err)
	}
	source = loaders.NewPlatformSettingsSource(database, adminSchema, time.Hour, slog.New(slog.NewTextHandler(io.Discard, nil)))
	policy := source.ReadEscrowPolicy(ctx, fallback)
	if policy.AutoReleasePeriod != 120*time.Hour || policy.SellerCreditHoldPeriod != 12*time.Hour || policy.SellerReserveBps != 300 {
		t.Fatalf("admin value must win over the fallback, got %+v", policy)
	}
	if _, err := database.Exec(`UPDATE ` + table + ` SET value = '{"autoReleaseDays":9,"sellerCreditHoldHours":1,"sellerReserveBps":0}'`); err != nil {
		t.Fatal(err)
	}
	if cached := source.ReadEscrowPolicy(ctx, fallback); cached.AutoReleasePeriod != 120*time.Hour {
		t.Fatalf("the value must be cached for the time to live, got %+v", cached)
	}
	expired := loaders.NewPlatformSettingsSource(database, adminSchema, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if fresh := expired.ReadEscrowPolicy(ctx, fallback); fresh.AutoReleasePeriod != 216*time.Hour {
		t.Fatalf("an expired entry must be re-read, got %+v", fresh)
	}
	if _, err := database.Exec(`DROP TABLE ` + table); err != nil {
		t.Fatal(err)
	}
	if stale := expired.ReadEscrowPolicy(ctx, fallback); stale.AutoReleasePeriod != 216*time.Hour {
		t.Fatalf("a failing read must serve the last good value, got %+v", stale)
	}
	disabled := loaders.NewPlatformSettingsSource(database, "", time.Hour, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if disabled.ReadEscrowPolicy(ctx, fallback) != fallback {
		t.Fatal("a source without an admin schema must always use the fallback")
	}
}

func TestGiftShareFollowsTheHighestReachedTier(t *testing.T) {
	tiers := []loaders.GiftShareTier{{MinimumMonthlyGiftCoins: 0, CreatorShareBps: 5000}, {MinimumMonthlyGiftCoins: 500, CreatorShareBps: 6000}, {MinimumMonthlyGiftCoins: 5000, CreatorShareBps: 7000}}
	for volume, want := range map[int64]int64{0: 5000, 499: 5000, 500: 6000, 4999: 6000, 5000: 7000, 9_000_000: 7000} {
		if got := loaders.GiftShareBpsForMonthlyVolume(tiers, volume); got != want {
			t.Errorf("volume %d: got %d want %d", volume, got, want)
		}
	}
}
