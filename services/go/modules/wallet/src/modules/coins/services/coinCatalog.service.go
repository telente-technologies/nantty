package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/coinpackage"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/modules/wallet/src/modules/coins/models"
	"zudomart/platform/httpserver"
)

var ErrCoinPackageNotFound = httpserver.NewApiError(http.StatusNotFound, "COIN_PACKAGE_NOT_FOUND", "Coin package was not found.")

type defaultCoinPackTier struct {
	tier             string
	nairaPriceMinor  int64
	dollarPriceMinor int64
	sortOrder        int
}

var defaultCoinPackTiers = []defaultCoinPackTier{
	{"1", 150_000, 99, 1}, {"2", 750_000, 499, 2}, {"3", 1_500_000, 999, 3}, {"4", 3_000_000, 1_999, 4}, {"5", 7_500_000, 4_999, 5},
}

type CoinPackDefinition struct {
	Id             string
	Name           string
	ClientPlatform coinpackage.ClientPlatform
	Coins          int64
	BonusCoins     int64
	Prices         map[string]int64
	StoreProductId string
	Active         bool
	SortOrder      int
}

type CoinCatalog struct {
	Container *container.Container
}

func (catalog CoinCatalog) DefaultCoinPackDefinitions() []CoinPackDefinition {
	settings := catalog.Container.Settings
	var definitions []CoinPackDefinition
	for _, platform := range []coinpackage.ClientPlatform{coinpackage.ClientPlatformWeb, coinpackage.ClientPlatformIos, coinpackage.ClientPlatformAndroid} {
		for _, tier := range defaultCoinPackTiers {
			definition := CoinPackDefinition{Id: string(platform) + "-coins-" + tier.tier, ClientPlatform: platform, Active: true, SortOrder: tier.sortOrder}
			pricedIn, price := "USD", tier.dollarPriceMinor
			if platform == coinpackage.ClientPlatformWeb {
				pricedIn, price = "NGN", tier.nairaPriceMinor
				definition.Prices = map[string]int64{"NGN": tier.nairaPriceMinor, "USD": tier.dollarPriceMinor}
			} else {
				definition.Prices = map[string]int64{"USD": tier.dollarPriceMinor}
				definition.StoreProductId = "zudomart." + string(platform) + ".coins.tier" + tier.tier
			}
			coins, err := models.CoinsForChannelPrice(price, settings.CoinChannelFeeBps[string(platform)], settings.CoinNetValueMinorByCurrency[pricedIn])
			if err != nil || coins <= 0 {
				continue
			}
			definition.Coins, definition.Name = coins, fmt.Sprintf("%d coins", coins)
			definitions = append(definitions, definition)
		}
	}
	return definitions
}

func (catalog CoinCatalog) SeedDefaultCoinPackagesWhenMissing(ctx context.Context) error {
	client := catalog.Container.Client(catalog.Container.Resources.Database)
	for _, definition := range catalog.DefaultCoinPackDefinitions() {
		prices, _ := json.Marshal(definition.Prices)
		err := client.CoinPackage.Create().SetID(definition.Id).SetName(definition.Name).SetCoins(definition.Coins).SetBonusCoins(definition.BonusCoins).
			SetPurchaseChannel(purchaseChannelForPlatform(definition.ClientPlatform)).SetClientPlatform(definition.ClientPlatform).SetPrices(prices).
			SetStoreProductID(definition.StoreProductId).SetSortOrder(definition.SortOrder).
			OnConflictColumns(coinpackage.FieldID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return nil
}

func purchaseChannelForPlatform(platform coinpackage.ClientPlatform) coinpackage.PurchaseChannel {
	if platform == coinpackage.ClientPlatformWeb {
		return coinpackage.PurchaseChannelWebCheckout
	}
	return coinpackage.PurchaseChannelStoreIap
}

func (catalog CoinCatalog) ListActiveCoinPackages(ctx context.Context, platform coinpackage.ClientPlatform, currency string, canCharge func(string) bool) ([]dtos.CoinPackageDto, error) {
	packs, err := catalog.Container.Client(catalog.Container.Resources.Database).CoinPackage.Query().
		Where(coinpackage.ClientPlatformEQ(platform), coinpackage.Active(true)).
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
		PurchaseChannel: string(pack.PurchaseChannel), ClientPlatform: string(pack.ClientPlatform), Price: dtos.MoneyDto{AmountMinor: price.AmountMinor, Currency: price.Currency},
	}
	if pack.StoreProductID != "" {
		storeProductId := pack.StoreProductID
		converted.StoreProductId = &storeProductId
	}
	return converted
}

func (catalog CoinCatalog) FindActivePackage(ctx context.Context, client *ent.Client, packageId string, channel coinpackage.PurchaseChannel) (*ent.CoinPackage, error) {
	pack, err := client.CoinPackage.Query().Where(coinpackage.ID(packageId), coinpackage.Active(true), coinpackage.PurchaseChannelEQ(channel), coinpackage.ClientPlatformEQ(coinpackage.ClientPlatformWeb)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrCoinPackageNotFound
	}
	return pack, err
}
