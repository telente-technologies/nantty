package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/coinpackage"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/models"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
)

var (
	ErrCoinPackageNotFound = httpserver.NewApiError(http.StatusNotFound, "COIN_PACKAGE_NOT_FOUND", "Coin package was not found.")
	ErrWebCurrencyDisabled = httpserver.NewApiError(http.StatusUnprocessableEntity, "WEB_CURRENCY_NOT_ENABLED", "Web checkout isn't available in your currency or in USD yet. Buy coins in the Nantty app, or try again later.")
)

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
	var definitions []CoinPackDefinition
	for _, platform := range []coinpackage.ClientPlatform{coinpackage.ClientPlatformWeb, coinpackage.ClientPlatformIos, coinpackage.ClientPlatformAndroid} {
		for _, tier := range regionpricing.DefaultCoinPackTiers {
			definition := CoinPackDefinition{
				Id: string(platform) + "-coins-" + tier.Tier, Name: fmt.Sprintf("%d coins", tier.Coins), ClientPlatform: platform, Coins: tier.Coins,
				Prices: regionpricing.CoinPackPrices(tier.Coins, string(platform)), Active: true, SortOrder: tier.SortOrder,
			}
			if platform == coinpackage.ClientPlatformWeb {
				definition.BonusCoins = tier.WebBonusCoins
			} else {
				definition.StoreProductId = regionpricing.DefaultStoreCoinProductId(tier.Tier)
			}
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
		existing, err := client.CoinPackage.Get(ctx, definition.Id)
		if err != nil {
			return err
		}
		merged, changed := DecodeCoinPackagePrices(existing), false
		for currency, amount := range definition.Prices {
			if _, priced := merged[currency]; !priced {
				merged[currency], changed = amount, true
			}
		}
		if changed {
			encoded, _ := json.Marshal(merged)
			if err := existing.Update().SetPrices(encoded).Exec(ctx); err != nil {
				return err
			}
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

func (catalog CoinCatalog) ListActiveCoinPackages(ctx context.Context, platform coinpackage.ClientPlatform, country, currency string, canCharge func(string) bool) ([]dtos.CoinPackageDto, error) {
	packs, err := catalog.Container.Client(catalog.Container.Resources.Database).CoinPackage.Query().
		Where(coinpackage.ClientPlatformEQ(platform), coinpackage.Active(true)).
		Order(ent.Asc(coinpackage.FieldSortOrder), ent.Asc(coinpackage.FieldCoins)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]dtos.CoinPackageDto, 0, len(packs))
	for _, pack := range packs {
		price, err := models.ChooseCoinPackagePriceForCountry(DecodeCoinPackagePrices(pack), country, currency, canCharge)
		if err != nil {
			continue
		}
		dto := ConvertCoinPackage(pack, price)
		if platform == coinpackage.ClientPlatformWeb && price.Currency != currency {
			dto.BillingNote = regionpricing.UsdBillingNote
		}
		converted = append(converted, dto)
	}
	if len(converted) == 0 && len(packs) > 0 && platform == coinpackage.ClientPlatformWeb {
		return nil, ErrWebCurrencyDisabled
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
