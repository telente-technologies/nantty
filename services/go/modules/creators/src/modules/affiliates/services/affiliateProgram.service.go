package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"zudomart/modules/creators/src/container"
	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliateproductcommission"
	programservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/creators/src/repositories"
	"zudomart/modules/ledger/src/databases"
	"zudomart/platform/httpserver"
)

var (
	ErrStoreNotFound        = httpserver.NewApiError(http.StatusNotFound, "STORE_NOT_FOUND", "You don't own an active store.")
	ErrProductNotFound      = httpserver.NewApiError(http.StatusNotFound, "PRODUCT_NOT_FOUND", "Product was not found.")
	ErrProgramOff           = httpserver.NewApiError(http.StatusConflict, "AFFILIATE_PROGRAM_OFF", "This store isn't running an affiliate program.")
	ErrRequestNotFound      = httpserver.NewApiError(http.StatusNotFound, "REQUEST_NOT_FOUND", "Request was not found.")
	ErrRequestDecided       = httpserver.NewApiError(http.StatusConflict, "REQUEST_ALREADY_DECIDED", "This request was already decided.")
	ErrAffiliateNotFound    = httpserver.NewApiError(http.StatusNotFound, "CREATOR_NOT_FOUND", "This creator isn't in your program.")
	ErrAlreadyAffiliated    = httpserver.NewApiError(http.StatusConflict, "ALREADY_AFFILIATED", "You already asked to promote this.")
	ErrCreatorOnly          = httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Affiliations are available to approved creators.")
	ErrChooseStoreOrProduct = httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "Choose a store or a product.")
)

type Affiliates struct {
	Container *container.Container
	Program   programservices.CreatorProgram
}

type ProgramSettingsView struct {
	Enabled                               bool   `json:"enabled"`
	DefaultCommissionBasisPoints          int64  `json:"defaultCommissionBasisPoints"`
	AutoApproveCreatorsWithFollowersAbove *int64 `json:"autoApproveCreatorsWithFollowersAbove"`
	CookieWindowDays                      int    `json:"cookieWindowDays"`
}

type SettingsChange struct {
	Enabled                   *bool
	DefaultCommissionBps      *int64
	AutoApproveFollowersAbove *int64
	ClearAutoApprove          bool
	CookieWindowDays          *int
}

func (affiliates Affiliates) MaximumBps() int64 {
	if maximum := affiliates.Container.Settings.Revenue.MaximumAffiliateBps; maximum > 0 {
		return maximum
	}
	return 5000
}

func (affiliates Affiliates) SellerStore(ctx context.Context, sellerUserId, storeId string) (repositories.StoreSummary, error) {
	store, found, err := affiliates.Container.Directory.FindOwnedStore(ctx, sellerUserId, storeId)
	if err != nil {
		return store, err
	}
	if !found {
		return store, ErrStoreNotFound
	}
	return store, nil
}

func convertSettings(row *ent.AffiliateProgramSetting) ProgramSettingsView {
	if row == nil {
		return ProgramSettingsView{CookieWindowDays: 30}
	}
	return ProgramSettingsView{Enabled: row.Enabled, DefaultCommissionBasisPoints: row.DefaultCommissionBps, AutoApproveCreatorsWithFollowersAbove: row.AutoApproveFollowersAbove, CookieWindowDays: row.CookieWindowDays}
}

func (affiliates Affiliates) settingsRow(ctx context.Context, client *ent.Client, storeId string) (*ent.AffiliateProgramSetting, error) {
	row, err := client.AffiliateProgramSetting.Get(ctx, storeId)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (affiliates Affiliates) Settings(ctx context.Context, store repositories.StoreSummary) (ProgramSettingsView, error) {
	row, err := affiliates.settingsRow(ctx, affiliates.Container.Client(affiliates.Container.Resources.Database), store.Id)
	return convertSettings(row), err
}

func (affiliates Affiliates) inTransaction(ctx context.Context, work func(context.Context, *sql.Tx, *ent.Client) error) error {
	return databases.RunInMoneyTransaction(ctx, affiliates.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return work(ctx, transaction, affiliates.Container.Client(transaction))
	})
}

func (affiliates Affiliates) UpdateSettings(ctx context.Context, store repositories.StoreSummary, change SettingsChange) (ProgramSettingsView, error) {
	var view ProgramSettingsView
	err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		current, err := affiliates.settingsRow(ctx, client, store.Id)
		if err != nil {
			return err
		}
		before := convertSettings(current)
		view = before
		if change.Enabled != nil {
			view.Enabled = *change.Enabled
		}
		if change.DefaultCommissionBps != nil {
			view.DefaultCommissionBasisPoints = *change.DefaultCommissionBps
		}
		if change.ClearAutoApprove {
			view.AutoApproveCreatorsWithFollowersAbove = nil
		} else if change.AutoApproveFollowersAbove != nil {
			view.AutoApproveCreatorsWithFollowersAbove = change.AutoApproveFollowersAbove
		}
		if change.CookieWindowDays != nil {
			view.CookieWindowDays = *change.CookieWindowDays
		}
		if current == nil {
			err = client.AffiliateProgramSetting.Create().SetID(store.Id).SetSellerUserID(store.OwnerUserId).SetCurrency(store.Currency).SetEnabled(view.Enabled).
				SetDefaultCommissionBps(view.DefaultCommissionBasisPoints).SetNillableAutoApproveFollowersAbove(view.AutoApproveCreatorsWithFollowersAbove).SetCookieWindowDays(view.CookieWindowDays).Exec(ctx)
		} else {
			update := current.Update().SetEnabled(view.Enabled).SetCurrency(store.Currency).SetDefaultCommissionBps(view.DefaultCommissionBasisPoints).SetCookieWindowDays(view.CookieWindowDays)
			if view.AutoApproveCreatorsWithFollowersAbove == nil {
				update.ClearAutoApproveFollowersAbove()
			} else {
				update.SetAutoApproveFollowersAbove(*view.AutoApproveCreatorsWithFollowersAbove)
			}
			err = update.Exec(ctx)
		}
		if err != nil {
			return err
		}
		return affiliates.audit(ctx, transaction, "affiliateProgram.settingsChanged", store, map[string]any{"before": before, "after": view})
	})
	return view, err
}

func (affiliates Affiliates) audit(ctx context.Context, transaction *sql.Tx, eventType string, store repositories.StoreSummary, data map[string]any) error {
	data["storeId"], data["sellerUserId"] = store.Id, store.OwnerUserId
	return affiliates.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, store.Id, affiliates.Container.Now().UTC(), data)
}

type ProductCommissionView struct {
	ProductId             string  `json:"productId"`
	ProductName           string  `json:"productName"`
	ImageUrl              *string `json:"imageUrl"`
	Price                 Money   `json:"price"`
	CommissionBasisPoints *int64  `json:"commissionBasisPoints"`
	Excluded              bool    `json:"excluded"`
	EstimatedCommission   Money   `json:"estimatedCommission"`
}

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

func EffectiveBps(defaultBps int64, override *ent.AffiliateProductCommission, maximum int64) int64 {
	rate := defaultBps
	if override != nil {
		if override.IsExcluded {
			return 0
		}
		if override.CommissionBps != nil {
			rate = *override.CommissionBps
		}
	}
	return min(max(rate, 0), maximum)
}

func ShareOf(amountMinor, bps int64) int64 {
	return amountMinor/10_000*bps + amountMinor%10_000*bps/10_000
}

func (affiliates Affiliates) ListProductCommissions(ctx context.Context, store repositories.StoreSummary, search string, limit int) ([]ProductCommissionView, error) {
	settings, err := affiliates.Settings(ctx, store)
	if err != nil {
		return nil, err
	}
	products, err := affiliates.Container.Directory.ListStoreProducts(ctx, store.Id, search, limit)
	if err != nil {
		return nil, err
	}
	overrides, err := affiliates.Container.Client(affiliates.Container.Resources.Database).AffiliateProductCommission.Query().Where(affiliateproductcommission.StoreID(store.Id)).All(ctx)
	if err != nil {
		return nil, err
	}
	byProduct := map[string]*ent.AffiliateProductCommission{}
	for _, override := range overrides {
		byProduct[override.ProductID] = override
	}
	views := make([]ProductCommissionView, 0, len(products))
	for _, product := range products {
		override := byProduct[product.Id]
		view := ProductCommissionView{ProductId: product.Id, ProductName: product.Name, Price: Money{product.PriceMinor, product.Currency}}
		if override != nil {
			view.CommissionBasisPoints, view.Excluded = override.CommissionBps, override.IsExcluded
		}
		view.EstimatedCommission = Money{ShareOf(product.PriceMinor, EffectiveBps(settings.DefaultCommissionBasisPoints, override, affiliates.MaximumBps())), product.Currency}
		views = append(views, view)
	}
	return views, nil
}

func (affiliates Affiliates) SetProductCommission(ctx context.Context, store repositories.StoreSummary, actorId, productId string, bps *int64, excluded bool) (map[string]any, error) {
	products, err := affiliates.Container.Directory.FindProducts(ctx, []string{productId})
	if err != nil {
		return nil, err
	}
	if product, found := products[productId]; !found || product.StoreId != store.Id {
		return nil, ErrProductNotFound
	}
	result := map[string]any{"productId": productId, "commissionBasisPoints": bps, "excluded": excluded}
	return result, affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		err := client.AffiliateProductCommission.Create().SetStoreID(store.Id).SetProductID(productId).SetNillableCommissionBps(bps).SetIsExcluded(excluded).
			SetUpdatedBy(actorId).SetCreatedAt(affiliates.Container.Now().UTC()).
			OnConflictColumns(affiliateproductcommission.FieldStoreID, affiliateproductcommission.FieldProductID).UpdateCommissionBps().UpdateIsExcluded().UpdateUpdatedBy().UpdateUpdatedAt().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		return affiliates.audit(ctx, transaction, "affiliateProgram.productCommissionChanged", store, map[string]any{"after": result, "actorId": actorId})
	})
}

func (affiliates Affiliates) CommissionRates(ctx context.Context, storeId string, productIds []string) (map[string]int64, error) {
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	rates := map[string]int64{}
	settings, err := affiliates.settingsRow(ctx, client, storeId)
	if err != nil || settings == nil || !settings.Enabled {
		for _, productId := range productIds {
			rates[productId] = 0
		}
		return rates, err
	}
	overrides, err := client.AffiliateProductCommission.Query().Where(affiliateproductcommission.StoreID(storeId), affiliateproductcommission.ProductIDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	byProduct := map[string]*ent.AffiliateProductCommission{}
	for _, override := range overrides {
		byProduct[override.ProductID] = override
	}
	for _, productId := range productIds {
		rates[productId] = EffectiveBps(settings.DefaultCommissionBps, byProduct[productId], affiliates.MaximumBps())
	}
	return rates, nil
}
