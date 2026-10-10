package getselleraccess

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/platform/sellerplans"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.SellerAccessView, error) {
	access, found, err := services.FindStoreAccess(ctx, handler.Container, query.AccountId, query.RequestedStore)
	if err != nil || !found {
		return types.SellerAccessView{}, err
	}
	store, err := handler.Container.Client.Store.Get(ctx, access.StoreId)
	if err != nil {
		return types.SellerAccessView{}, err
	}
	storeId, role := access.StoreId.String(), access.Role
	status := "unverified"
	if store.Verified {
		status = "verified"
	}
	view := types.SellerAccessView{
		StoreId: &storeId, StoreName: &store.Name, Role: &role, Permissions: access.Permissions,
		Verification: map[string]any{"status": status, "color": "GOLD", "tier": nil, "badgeVisible": store.Verified},
	}
	if plan := sellerplans.Default.PlanOf(ctx, store.OwnerAccountID); !sellerplans.Default.AllowAll && plan != sellerplans.Free && plan != "" {
		view.Subscription = map[string]any{"status": "active", "plan": strings.ToUpper(string(plan)), "currentPeriodEnd": nil}
	}
	return view, nil
}
