package services

import (
	"context"
	"net/http"

	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/coinpackage"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/models"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
)

var ErrCoinPriceRowInvalid = httpserver.NewApiError(http.StatusUnprocessableEntity, "COIN_PRICE_ROW_INVALID", "A coin pack needs a price and a positive coin amount.")

func (catalog CoinCatalog) ListCoinPriceTable(ctx context.Context) ([]dtos.CoinPackagePriceRowDto, error) {
	packs, err := catalog.Container.Client(catalog.Container.Resources.Database).CoinPackage.Query().
		Order(ent.Asc(coinpackage.FieldClientPlatform), ent.Asc(coinpackage.FieldSortOrder)).All(ctx)
	if err != nil {
		return nil, err
	}
	rows := make([]dtos.CoinPackagePriceRowDto, len(packs))
	for index, pack := range packs {
		rows[index] = convertCoinPriceRow(pack)
	}
	return rows, nil
}

func (catalog CoinCatalog) UpsertCoinPriceRow(ctx context.Context, row dtos.CoinPackagePriceRowDto) (dtos.CoinPackagePriceRowDto, error) {
	platform := coinpackage.ClientPlatform(row.ClientPlatform)
	if coinpackage.ClientPlatformValidator(platform) != nil || len(row.Prices) == 0 || row.BonusCoins < 0 {
		return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
	}
	if row.Coins == 0 {
		pricedIn := "USD"
		if platform == coinpackage.ClientPlatformWeb {
			pricedIn = "NGN"
		}
		coins, err := models.CoinsForChannelPrice(row.Prices[pricedIn], catalog.Container.Settings.CoinChannelFeeBps[row.ClientPlatform], catalog.Container.Settings.CoinNetValueMinorByCurrency[pricedIn])
		if err != nil {
			return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
		}
		row.Coins = coins
	}
	for currency, price := range row.Prices {
		if price <= 0 || !regionpricing.IsSupportedCurrency(currency) {
			return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
		}
	}
	for country, price := range row.CountryPrices {
		code := regionpricing.NormalizeCountryCode(country)
		region, supported := regionpricing.RegionForCountry(code)
		if !supported || price.Currency != region.Currency || price.AmountMinor <= 0 {
			return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
		}
	}
	if row.Coins <= 0 || (platform != coinpackage.ClientPlatformWeb && row.StoreProductId == "") {
		return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
	}
	prices, err := encodeCoinPrices(row.Prices, row.CountryPrices)
	if err != nil {
		return dtos.CoinPackagePriceRowDto{}, ErrCoinPriceRowInvalid
	}
	err = catalog.Container.Client(catalog.Container.Resources.Database).CoinPackage.Create().
		SetID(row.Id).SetName(row.Name).SetClientPlatform(platform).SetPurchaseChannel(purchaseChannelForPlatform(platform)).
		SetCoins(row.Coins).SetBonusCoins(row.BonusCoins).SetPrices(prices).SetStoreProductID(row.StoreProductId).SetActive(row.Active).SetSortOrder(row.SortOrder).
		OnConflictColumns(coinpackage.FieldID).UpdateName().UpdateClientPlatform().UpdatePurchaseChannel().UpdateCoins().UpdateBonusCoins().
		UpdatePrices().UpdateStoreProductID().UpdateActive().UpdateSortOrder().UpdateUpdatedAt().Exec(ctx)
	return row, err
}

func convertCoinPriceRow(pack *ent.CoinPackage) dtos.CoinPackagePriceRowDto {
	return dtos.CoinPackagePriceRowDto{
		Id: pack.ID, Name: pack.Name, ClientPlatform: string(pack.ClientPlatform), Coins: pack.Coins, BonusCoins: pack.BonusCoins,
		Prices: decodeCoinPackageBasePrices(pack), CountryPrices: DecodeCoinPackageCountryPrices(pack), StoreProductId: pack.StoreProductID, Active: pack.Active, SortOrder: pack.SortOrder,
	}
}
