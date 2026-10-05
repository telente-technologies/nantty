package integrations

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/modules/orders/src/generated/ent/storerewardsettings"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
)

type CommerceOrders struct {
	Container *container.Container
}

var _ commerceports.PurchaseVerifier = CommerceOrders{}
var _ commerceports.StoreRewardsLookup = CommerceOrders{}
var _ commerceports.StoreSuccessRates = CommerceOrders{}

var receivedStatuses = []string{enums.StatusDelivered, enums.StatusCompleted}

func (orders CommerceOrders) FindReceivedPurchaseFromStore(ctx context.Context, accountId, storeId uuid.UUID) (string, bool, error) {
	group, err := orders.Container.Client.OrderGroup.Query().Where(ordergroup.BuyerAccountID(accountId), ordergroup.StoreID(storeId), ordergroup.StatusIn(receivedStatuses...)).
		Order(ent.Desc(ordergroup.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return group.Reference, true, nil
}

func (orders CommerceOrders) FindReceivedPurchaseOfProduct(ctx context.Context, accountId, productId uuid.UUID) (string, bool, error) {
	groups, err := orders.Container.Client.OrderGroup.Query().Where(ordergroup.BuyerAccountID(accountId), ordergroup.StatusIn(receivedStatuses...)).Order(ent.Desc(ordergroup.FieldID)).Limit(200).All(ctx)
	if err != nil {
		return "", false, err
	}
	ids := make([]uuid.UUID, 0, len(groups))
	for _, group := range groups {
		ids = append(ids, group.ID)
	}
	bought, err := orders.Container.Client.OrderItem.Query().Where(orderitem.ProductID(productId), orderitem.OrderGroupIDIn(ids...)).First(ctx)
	if ent.IsNotFound(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	for _, group := range groups {
		if group.ID == bought.OrderGroupID {
			return group.Reference, true, nil
		}
	}
	return "", false, nil
}

func (orders CommerceOrders) EarnBackBasisPointsByStore(ctx context.Context, storeIds []uuid.UUID) (map[uuid.UUID]int, error) {
	rows, err := orders.Container.Client.StoreRewardSettings.Query().Where(storerewardsettings.StoreIDIn(storeIds...), storerewardsettings.Enabled(true)).All(ctx)
	if err != nil {
		return nil, err
	}
	result := map[uuid.UUID]int{}
	for _, row := range rows {
		result[row.StoreID] = row.PercentBackBasisPoints
	}
	return result, nil
}

func (orders CommerceOrders) SuccessRatesByStore(ctx context.Context, storeIds []uuid.UUID) (map[uuid.UUID]float64, error) {
	return services.StoreSuccessRates(ctx, orders.Container, storeIds)
}

func (orders CommerceOrders) RewardRulesForStore(ctx context.Context, storeId uuid.UUID) (commerceports.StoreRewardRules, error) {
	row, err := orders.Container.Client.StoreRewardSettings.Query().Where(storerewardsettings.StoreID(storeId)).Only(ctx)
	if ent.IsNotFound(err) {
		return commerceports.StoreRewardRules{ExpiryDays: 180}, nil
	}
	if err != nil {
		return commerceports.StoreRewardRules{}, err
	}
	return commerceports.StoreRewardRules{Enabled: row.Enabled, PercentBackBasisPoints: row.PercentBackBasisPoints, MinimumOrderMinor: row.MinimumOrderMinor,
		MaxPerOrderMinor: row.MaxPerOrderMinor, ExpiryDays: row.ExpiryDays, Found: true}, nil
}
