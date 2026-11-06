package services

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"nantty/modules/ledger/src/loaders"
	"nantty/modules/wallet/src/configs"
	"nantty/modules/wallet/src/container"
)

func TestCoinTransferFeeAndCashValuesFollowTheAdminRevenueSetting(t *testing.T) {
	revenue := ""
	platform := loaders.NewPlatformSettingsSourceFromFetcher(func(context.Context, string) (json.RawMessage, error) {
		return json.RawMessage(revenue), nil
	}, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	walletContainer := &container.Container{
		Resources: loaders.MoneyModuleResources{Platform: platform},
		Settings:  configs.WalletSettings{CoinTransferFeeBps: 200, CoinCashValueMinorByCurrency: map[string]int64{"NGN": 1000}},
	}
	transfers := CoinTransfers{Container: walletContainer}
	ctx := context.Background()

	revenue = `not json`
	quote, err := transfers.QuoteTransfer(ctx, 100)
	if err != nil || quote.FeeCoins != 2 || quote.FeePercent != 2 || walletContainer.CoinCashValuesMinor(ctx)["NGN"] != 1000 {
		t.Fatalf("unreadable setting must fall back to the environment, got %+v %v", quote, err)
	}
	revenue = `{"coinTransferFeeBasisPoints":1000,"coinUnitValues":[{"amountMinor":1500,"currency":"NGN"}]}`
	quote, err = transfers.QuoteTransfer(ctx, 100)
	if err != nil || quote.FeeCoins != 10 || quote.FeePercent != 10 || walletContainer.CoinCashValuesMinor(ctx)["NGN"] != 1500 {
		t.Fatalf("a changed setting must take effect, got %+v %v", quote, err)
	}
}
