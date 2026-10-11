package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	"zudomart/modules/creators/src/generated/ent/affiliateproductcommission"
	"zudomart/modules/creators/src/generated/ent/creatoraffiliation"
	"zudomart/modules/creators/src/repositories"
)

type AffiliationView struct {
	Id                string                     `json:"id"`
	Store             *repositories.StoreSummary `json:"store"`
	Product           *AffiliatedProductView     `json:"product"`
	CommissionPercent float64                    `json:"commissionPercent"`
	Status            string                     `json:"status"`
	SalesCount        int                        `json:"salesCount"`
	Earned            Money                      `json:"earned"`
	CreatedAt         time.Time                  `json:"createdAt"`
}

type AffiliatedProductView struct {
	Id       string  `json:"id"`
	Name     string  `json:"name"`
	Price    Money   `json:"price"`
	ImageUrl *string `json:"imageUrl"`
}

type AffiliationRequest struct {
	CreatorId string
	StoreId   string
	ProductId string
	Message   string
}

var openStatuses = []creatoraffiliation.Status{creatoraffiliation.StatusRequested, creatoraffiliation.StatusActive, creatoraffiliation.StatusPaused}

func mobileStatus(status creatoraffiliation.Status) string {
	switch status {
	case creatoraffiliation.StatusActive, creatoraffiliation.StatusPaused:
		return "active"
	case creatoraffiliation.StatusRequested:
		return "requested"
	}
	return "declined"
}

func (affiliates Affiliates) RequestAffiliation(ctx context.Context, request AffiliationRequest) (AffiliationView, error) {
	if _, approved, err := affiliates.Program.ApprovedCreatorShare(ctx, affiliates.Container.Resources.Database, request.CreatorId); err != nil || !approved {
		if err == nil {
			err = ErrCreatorOnly
		}
		return AffiliationView{}, err
	}
	directory := affiliates.Container.Directory
	if request.ProductId != "" {
		products, err := directory.FindProducts(ctx, []string{request.ProductId})
		if err != nil {
			return AffiliationView{}, err
		}
		product, found := products[request.ProductId]
		if !found || !product.Published || (request.StoreId != "" && request.StoreId != product.StoreId) {
			return AffiliationView{}, ErrProductNotFound
		}
		request.StoreId = product.StoreId
	}
	if request.StoreId == "" {
		return AffiliationView{}, ErrChooseStoreOrProduct
	}
	stores, err := directory.FindStores(ctx, []string{request.StoreId})
	if err != nil {
		return AffiliationView{}, err
	}
	store, found := stores[request.StoreId]
	if !found || !store.Active {
		return AffiliationView{}, ErrStoreNotFound
	}
	if store.OwnerUserId == request.CreatorId {
		return AffiliationView{}, ErrAlreadyAffiliated
	}
	settings, err := affiliates.Settings(ctx, store)
	if err != nil {
		return AffiliationView{}, err
	}
	if !settings.Enabled {
		return AffiliationView{}, ErrProgramOff
	}
	status := creatoraffiliation.StatusRequested
	if threshold := settings.AutoApproveCreatorsWithFollowersAbove; threshold != nil {
		if followers, err := directory.FollowerCount(ctx, request.CreatorId); err == nil && followers > *threshold {
			status = creatoraffiliation.StatusActive
		}
	}
	var created *ent.CreatorAffiliation
	err = affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		create := client.CreatorAffiliation.Create().SetID(uuid.Must(uuid.NewV7())).SetCreatorID(request.CreatorId).SetStoreID(store.Id).SetProductID(request.ProductId).
			SetStatus(status).SetMessage(request.Message).SetCreatedAt(affiliates.Container.Now().UTC())
		if status == creatoraffiliation.StatusActive {
			create.SetDecidedAt(affiliates.Container.Now().UTC()).SetDecisionReason("auto-approved")
		}
		var err error
		if created, err = create.Save(ctx); ent.IsConstraintError(err) {
			return ErrAlreadyAffiliated
		} else if err != nil {
			return err
		}
		return affiliates.audit(ctx, transaction, "affiliation.requested", store, map[string]any{"affiliationId": created.ID.String(), "creatorId": request.CreatorId, "status": status.String()})
	})
	if err != nil {
		return AffiliationView{}, err
	}
	views, err := affiliates.presentAffiliations(ctx, []*ent.CreatorAffiliation{created})
	return views[0], err
}

func (affiliates Affiliates) ListMyAffiliations(ctx context.Context, creatorId string) ([]AffiliationView, error) {
	rows, err := affiliates.Container.Client(affiliates.Container.Resources.Database).CreatorAffiliation.Query().
		Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StatusNEQ(creatoraffiliation.StatusRemoved)).Order(ent.Desc(creatoraffiliation.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return nil, err
	}
	return affiliates.presentAffiliations(ctx, rows)
}

func (affiliates Affiliates) LeaveAffiliation(ctx context.Context, creatorId, affiliationId string) error {
	id, err := uuid.Parse(affiliationId)
	if err != nil {
		return ErrAffiliateNotFound
	}
	count, err := affiliates.Container.Client(affiliates.Container.Resources.Database).CreatorAffiliation.Update().
		Where(creatoraffiliation.ID(id), creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StatusIn(openStatuses...)).SetStatus(creatoraffiliation.StatusRemoved).Save(ctx)
	if err == nil && count == 0 {
		return ErrAffiliateNotFound
	}
	return err
}

func (affiliates Affiliates) ListAffiliatedProducts(ctx context.Context, creatorId string) ([]AffiliatedProductView, error) {
	rows, err := affiliates.Container.Client(affiliates.Container.Resources.Database).CreatorAffiliation.Query().
		Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StatusEQ(creatoraffiliation.StatusActive), creatoraffiliation.ProductIDNEQ("")).All(ctx)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ProductID)
	}
	products, err := affiliates.Container.Directory.FindProducts(ctx, ids)
	views := []AffiliatedProductView{}
	for _, id := range ids {
		if product, found := products[id]; found && product.Published {
			views = append(views, AffiliatedProductView{Id: product.Id, Name: product.Name, Price: Money{product.PriceMinor, product.Currency}})
		}
	}
	return views, err
}

func (affiliates Affiliates) presentAffiliations(ctx context.Context, rows []*ent.CreatorAffiliation) ([]AffiliationView, error) {
	storeIds, productIds := []string{}, []string{}
	for _, row := range rows {
		storeIds = append(storeIds, row.StoreID)
		if row.ProductID != "" {
			productIds = append(productIds, row.ProductID)
		}
	}
	stores, err := affiliates.Container.Directory.FindStores(ctx, storeIds)
	if err != nil {
		return nil, err
	}
	products, err := affiliates.Container.Directory.FindProducts(ctx, productIds)
	if err != nil {
		return nil, err
	}
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	views := make([]AffiliationView, 0, len(rows))
	for _, row := range rows {
		view := AffiliationView{Id: row.ID.String(), Status: mobileStatus(row.Status), CreatedAt: row.CreatedAt}
		if store, found := stores[row.StoreID]; found {
			view.Store = &store
		}
		settings, err := affiliates.settingsRow(ctx, client, row.StoreID)
		if err != nil {
			return nil, err
		}
		defaultBps := convertSettings(settings).DefaultCommissionBasisPoints
		var override *ent.AffiliateProductCommission
		if product, found := products[row.ProductID]; found {
			view.Product = &AffiliatedProductView{Id: product.Id, Name: product.Name, Price: Money{product.PriceMinor, product.Currency}}
			if override, err = client.AffiliateProductCommission.Query().Where(affiliateproductcommission.StoreID(row.StoreID), affiliateproductcommission.ProductID(row.ProductID)).Only(ctx); err != nil && !ent.IsNotFound(err) {
				return nil, err
			}
		}
		view.CommissionPercent = float64(EffectiveBps(defaultBps, override, affiliates.MaximumBps())) / 100
		commissions, err := client.AffiliateCommission.Query().Where(affiliatecommission.CreatorID(row.CreatorID), affiliatecommission.StoreID(row.StoreID),
			affiliatecommission.StatusNEQ(affiliatecommission.StatusReversed)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, commission := range commissions {
			if row.ProductID == "" || commission.ProductID == row.ProductID {
				view.SalesCount++
				if commission.Status == affiliatecommission.StatusPaid {
					view.Earned = Money{view.Earned.AmountMinor + commission.CommissionMinor, commission.Currency}
				}
			}
		}
		if view.Earned.Currency == "" && view.Store != nil {
			view.Earned.Currency = view.Store.Currency
		}
		views = append(views, view)
	}
	return views, nil
}
