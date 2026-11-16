package loaders_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"nantty/modules/ledger/src/loaders"
)

type mutableSettings map[string]string

func (settings mutableSettings) source(timeToLive time.Duration) *loaders.PlatformSettingsSource {
	return loaders.NewPlatformSettingsSourceFromFetcher(func(_ context.Context, key string) (json.RawMessage, error) {
		value, found := settings[key]
		if !found {
			return nil, sql.ErrNoRows
		}
		if value == "unavailable" {
			return nil, errors.New("connection refused")
		}
		return json.RawMessage(value), nil
	}, timeToLive, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestRevenueRulesComeFromTheAdminSettingAndFallBackToTheEnvironment(t *testing.T) {
	ctx := context.Background()
	settings := mutableSettings{}
	source := settings.source(0)
	fallbackValues := map[string]int64{"NGN": 1000}
	if source.CoinTransferFeeBps(ctx, 2500) != 2500 || source.CreatorAdShareBps(ctx, 4000) != 4000 || source.CoinCashValuesMinor(ctx, fallbackValues)["NGN"] != 1000 {
		t.Fatal("a missing revenue setting must use the environment values")
	}
	settings[loaders.RevenueRulesSettingKey] = `{"creatorAdShareBasisPoints":4500,"coinTransferFeeBasisPoints":2000,"coinUnitValues":[{"amountMinor":1200,"currency":"NGN"}],"escrowFee":{"defaultBasisPoints":175,"businessPlanBasisPoints":90}}`
	standard, business := source.EscrowFeeBps(ctx, 150, 100)
	if source.CoinTransferFeeBps(ctx, 2500) != 2000 || source.CreatorAdShareBps(ctx, 4000) != 4500 || source.CoinCashValuesMinor(ctx, fallbackValues)["NGN"] != 1200 || standard != 175 || business != 90 {
		t.Fatal("a changed revenue setting must take effect")
	}
	settings[loaders.RevenueRulesSettingKey] = `not json`
	if source.CoinTransferFeeBps(ctx, 2500) != 2500 {
		t.Fatal("an unreadable revenue setting must use the environment value")
	}
	settings[loaders.RevenueRulesSettingKey] = `{"escrowFee":{"defaultBasisPoints":100,"businessPlanBasisPoints":300}}`
	if standard, business := source.EscrowFeeBps(ctx, 150, 100); standard != 150 || business != 100 {
		t.Fatalf("a business rate above the default must be refused, got %d/%d", standard, business)
	}
}

func TestRevenueRulesAreCachedForTheTimeToLive(t *testing.T) {
	ctx := context.Background()
	settings := mutableSettings{loaders.RevenueRulesSettingKey: `{"coinTransferFeeBasisPoints":2000}`}
	source := settings.source(time.Hour)
	if source.CoinTransferFeeBps(ctx, 2500) != 2000 {
		t.Fatal("first read")
	}
	settings[loaders.RevenueRulesSettingKey] = `{"coinTransferFeeBasisPoints":1000}`
	if source.CoinTransferFeeBps(ctx, 2500) != 2000 {
		t.Fatal("the value must be cached")
	}
	refreshSource := settings.source(10 * time.Millisecond)
	if refreshSource.CoinTransferFeeBps(ctx, 2500) != 1000 {
		t.Fatal("a fresh settings source reads the latest value")
	}
	settings[loaders.RevenueRulesSettingKey] = `{"coinTransferFeeBasisPoints":1500}`
	time.Sleep(20 * time.Millisecond)
	if refreshSource.CoinTransferFeeBps(ctx, 2500) != 1500 {
		t.Fatal("an expired entry must be re-read")
	}
	settings[loaders.RevenueRulesSettingKey] = "unavailable"
	time.Sleep(20 * time.Millisecond)
	if refreshSource.CoinTransferFeeBps(ctx, 2500) != 1500 {
		t.Fatal("a failing read must keep the last good value")
	}
}
