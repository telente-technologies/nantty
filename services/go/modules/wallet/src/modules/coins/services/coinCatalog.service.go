package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/coinpackage"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/modules/wallet/src/modules/coins/models"
	"zudomart/platform/httpserver"
)

var ErrCoinPackageNotFound = httpserver.NewApiError(http.StatusNotFound, "COIN_PACKAGE_NOT_FOUND", "Coin package was not found.")

type defaultCoinPackage struct {
	id, name, storeProductId string
	coins, bonus             int64
	channel                  coinpackage.PurchaseChannel
	prices                   map[string]int64
	sortOrder                int
}

var defaultCoinPackages = []defaultCoinPackage{
	{"coins-70", "70 coins", "", 70, 0, coinpackage.PurchaseChannelWebCheckout, map[string]int64{"NGN": 150_000, "GHS": 1_200, "KES": 13_000, "ZAR": 1_800, "GBP": 79, "EUR": 89, "USD": 99}, 1},
	{"coins-350", "350 coins", "", 350, 0, coinpackage.PurchaseChannelWebCheckout, map[string]int64{"NGN": 750_000, "GHS": 6_000, "KES": 65_000, "ZAR": 9_000, "GBP": 399, "EUR": 449, "USD": 499}, 2},
	{"coins-700", "700 coins", "", 700, 35, coinpackage.PurchaseChannelWebCheckout, map[string]int64{"NGN": 1_500_000, "GHS": 12_000, "KES": 130_000, "ZAR": 18_000, "GBP": 799, "EUR": 899, "USD": 999}, 3},
	{"coins-1400", "1,400 coins", "", 1_400, 140, coinpackage.PurchaseChannelWebCheckout, map[string]int64{"NGN": 3_000_000, "GHS": 24_000, "KES": 260_000, "ZAR": 36_000, "GBP": 1_599, "EUR": 1_799, "USD": 1_999}, 4},
	{"coins-3500", "3,500 coins", "", 3_500, 525, coinpackage.PurchaseChannelWebCheckout, map[string]int64{"NGN": 7_500_000, "GHS": 60_000, "KES": 650_000, "ZAR": 90_000, "GBP": 3_999, "EUR": 4_499, "USD": 4_999}, 5},
	{"app-coins-60", "60 coins", "zudomart.coins.60", 60, 0, coinpackage.PurchaseChannelStoreIap, map[string]int64{"USD": 99}, 1},
	{"app-coins-300", "300 coins", "zudomart.coins.300", 300, 0, coinpackage.PurchaseChannelStoreIap, map[string]int64{"USD": 499}, 2},
	{"app-coins-600", "600 coins", "zudomart.coins.600", 600, 30, coinpackage.PurchaseChannelStoreIap, map[string]int64{"USD": 999}, 3},
	{"app-coins-1200", "1,200 coins", "zudomart.coins.1200", 1_200, 120, coinpackage.PurchaseChannelStoreIap, map[string]int64{"USD": 1_999}, 4},
}

type CoinCatalog struct {
	Container *container.Container
}

func (catalog CoinCatalog) SeedDefaultCoinPackagesWhenMissing(ctx context.Context) error {
	client := catalog.Container.Client(catalog.Container.Resources.Database)
	for _, pack := range defaultCoinPackages {
		prices, _ := json.Marshal(pack.prices)
		err := client.CoinPackage.Create().SetID(pack.id).SetName(pack.name).SetCoins(pack.coins).SetBonusCoins(pack.bonus).
			SetPurchaseChannel(pack.channel).SetPrices(prices).SetStoreProductID(pack.storeProductId).SetSortOrder(pack.sortOrder).
			OnConflictColumns(coinpackage.FieldID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return nil
}

func (catalog CoinCatalog) ListActiveCoinPackages(ctx context.Context, channel coinpackage.PurchaseChannel, currency string, canCharge func(string) bool) ([]dtos.CoinPackageDto, error) {
	packs, err := catalog.Container.Client(catalog.Container.Resources.Database).CoinPackage.Query().
		Where(coinpackage.PurchaseChannelEQ(channel), coinpackage.Active(true)).
		Order(ent.Asc(coinpackage.FieldSortOrder), ent.Asc(coinpackage.FieldCoins)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]dtos.CoinPackageDto, 0, len(packs))
	for _, pack := range packs {
		price, err := models.ChooseCoinPackagePrice(DecodeCoinPackagePrices(pack), currency, canCharge)
		if err != nil {
			continue
		}
		converted = append(converted, ConvertCoinPackage(pack, price))
	}
	return converted, nil
}

func DecodeCoinPackagePrices(pack *ent.CoinPackage) map[string]int64 {
	prices := map[string]int64{}
	_ = json.Unmarshal(pack.Prices, &prices)
	return prices
}

func ConvertCoinPackage(pack *ent.CoinPackage, price models.ChosenPrice) dtos.CoinPackageDto {
	converted := dtos.CoinPackageDto{
		Id: pack.ID, Name: pack.Name, Coins: pack.Coins, BonusCoins: pack.BonusCoins, TotalCoins: pack.Coins + pack.BonusCoins,
		PurchaseChannel: string(pack.PurchaseChannel), Price: dtos.MoneyDto{AmountMinor: price.AmountMinor, Currency: price.Currency},
	}
	if pack.StoreProductID != "" {
		storeProductId := pack.StoreProductID
		converted.StoreProductId = &storeProductId
	}
	return converted
}

func (catalog CoinCatalog) FindActivePackage(ctx context.Context, client *ent.Client, packageId string, channel coinpackage.PurchaseChannel) (*ent.CoinPackage, error) {
	pack, err := client.CoinPackage.Query().Where(coinpackage.ID(packageId), coinpackage.Active(true), coinpackage.PurchaseChannelEQ(channel)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrCoinPackageNotFound
	}
	return pack, err
}
