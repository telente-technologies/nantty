package listmystorecredit

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent/storecreditentry"
	"zudomart/modules/orders/src/generated/ent/storerewardsettings"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

type BalanceView struct {
	StoreId             string      `json:"storeId"`
	StoreName           string      `json:"storeName"`
	LogoUrl             *string     `json:"logoUrl"`
	Balance             money.Money `json:"balance"`
	ExpiresAt           *time.Time  `json:"expiresAt"`
	EarnBackBasisPoints *int        `json:"earnBackBasisPoints"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[BalanceView], error) {
	empty := httpserver.CursorPage[BalanceView]{}
	states, err := services.LoadCreditStatesForBuyer(ctx, handler.Container.Client, query.BuyerId, nil, handler.Container.Now())
	if err != nil {
		return empty, err
	}
	storeIds := make([]uuid.UUID, 0, len(states))
	for storeId, state := range states {
		if state.BalanceMinor > 0 {
			storeIds = append(storeIds, storeId)
		}
	}
	catalog, err := handler.Container.Catalog()
	if err != nil {
		return empty, err
	}
	stores, err := catalog.DescribeStores(ctx, storeIds)
	if err != nil {
		return empty, err
	}
	currencies, err := handler.currencies(ctx, query.BuyerId, storeIds)
	if err != nil {
		return empty, err
	}
	rules, err := handler.Container.Client.StoreRewardSettings.Query().Where(storerewardsettings.StoreIDIn(storeIds...)).All(ctx)
	if err != nil {
		return empty, err
	}
	earnBack := map[uuid.UUID]int{}
	for _, row := range rules {
		if row.Enabled {
			earnBack[row.StoreID] = row.PercentBackBasisPoints
		}
	}
	views := make([]BalanceView, 0, len(storeIds))
	for _, storeId := range storeIds {
		store, state := stores[storeId], states[storeId]
		view := BalanceView{StoreId: storeId.String(), StoreName: store.Name, Balance: money.Money{AmountMinor: state.BalanceMinor, Currency: currencies[storeId]}, ExpiresAt: state.NextExpiryAt}
		if store.LogoUrl != "" {
			view.LogoUrl = &store.LogoUrl
		}
		if basisPoints, enabled := earnBack[storeId]; enabled {
			view.EarnBackBasisPoints = &basisPoints
		}
		views = append(views, view)
	}
	sort.Slice(views, func(left, right int) bool { return views[left].StoreName < views[right].StoreName })
	return httpserver.NewCursorPage(views, ""), nil
}

func (handler Handler) currencies(ctx context.Context, buyerId uuid.UUID, storeIds []uuid.UUID) (map[uuid.UUID]money.CurrencyCode, error) {
	rows, err := handler.Container.Client.StoreCreditEntry.Query().Where(storecreditentry.BuyerAccountID(buyerId), storecreditentry.StoreIDIn(storeIds...)).
		Select(storecreditentry.FieldStoreID, storecreditentry.FieldCurrency).All(ctx)
	if err != nil {
		return nil, err
	}
	result := map[uuid.UUID]money.CurrencyCode{}
	for _, row := range rows {
		result[row.StoreID] = money.CurrencyCode(row.Currency)
	}
	return result, nil
}
