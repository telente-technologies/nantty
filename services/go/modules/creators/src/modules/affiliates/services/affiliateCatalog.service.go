package services

import (
	"context"
	"sort"
	"strconv"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatelink"
	"nantty/modules/creators/src/generated/ent/affiliateproductcommission"
	"nantty/modules/creators/src/generated/ent/affiliateprogramsetting"
	"nantty/modules/creators/src/generated/ent/creatoraffiliation"
	"nantty/modules/creators/src/repositories"
)

const maximumProgrammeStores = 1000

type ProgrammeTermsView struct {
	DefaultCommissionPercent  float64 `json:"defaultCommissionPercent"`
	AttributionWindowDays     int     `json:"attributionWindowDays"`
	Approval                  string  `json:"approval"`
	AutoApproveFollowersAbove *int64  `json:"autoApproveFollowersAbove"`
	CommissionPaidWhen        string  `json:"commissionPaidWhen"`
}

type PromotableProductView struct {
	ProductId             string                    `json:"productId"`
	Name                  string                    `json:"name"`
	ImageUrl              *string                   `json:"imageUrl"`
	Price                 Money                     `json:"price"`
	Stock                 *int64                    `json:"stock"`
	Store                 repositories.StoreSummary `json:"store"`
	CommissionBasisPoints int64                     `json:"commissionBasisPoints"`
	CommissionPercent     float64                   `json:"commissionPercent"`
	EstimatedCommission   Money                     `json:"estimatedCommission"`
	Access                string                    `json:"access"`
	Link                  *AffiliateLinkView        `json:"link"`
	Programme             ProgrammeTermsView        `json:"programme"`
}

type CatalogFilter struct {
	Search, StoreId, Sort, Access, Cursor string
	Limit                                 int
}

type creatorProgrammeContext struct {
	settings     map[string]*ent.AffiliateProgramSetting
	stores       map[string]repositories.StoreSummary
	affiliations []*ent.CreatorAffiliation
	followers    int64
}

func programmeTerms(settings *ent.AffiliateProgramSetting, maximum int64) ProgrammeTermsView {
	view := convertSettings(settings)
	terms := ProgrammeTermsView{DefaultCommissionPercent: float64(min(view.DefaultCommissionBasisPoints, maximum)) / 100, AttributionWindowDays: view.CookieWindowDays,
		Approval: "manual", AutoApproveFollowersAbove: view.AutoApproveCreatorsWithFollowersAbove, CommissionPaidWhen: "order_completed"}
	if terms.AutoApproveFollowersAbove != nil {
		terms.Approval = "automatic"
	}
	return terms
}

func (affiliates Affiliates) loadCreatorProgrammes(ctx context.Context, client *ent.Client, creatorId, onlyStoreId string) (creatorProgrammeContext, []string, error) {
	query := client.AffiliateProgramSetting.Query().Where(affiliateprogramsetting.Enabled(true))
	if onlyStoreId != "" {
		query.Where(affiliateprogramsetting.ID(onlyStoreId))
	}
	rows, err := query.Order(ent.Desc(affiliateprogramsetting.FieldDefaultCommissionBps)).Limit(maximumProgrammeStores).All(ctx)
	if err != nil {
		return creatorProgrammeContext{}, nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	stores, err := affiliates.Container.Directory.FindStores(ctx, ids)
	if err != nil {
		return creatorProgrammeContext{}, nil, err
	}
	programmes := creatorProgrammeContext{settings: map[string]*ent.AffiliateProgramSetting{}, stores: stores}
	ordered := []string{}
	for _, row := range rows {
		if store, found := stores[row.ID]; found && store.Active && store.OwnerUserId != creatorId {
			programmes.settings[row.ID] = row
			ordered = append(ordered, row.ID)
		}
	}
	if programmes.affiliations, err = client.CreatorAffiliation.Query().Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StoreIDIn(ordered...),
		creatoraffiliation.StatusNEQ(creatoraffiliation.StatusRemoved)).All(ctx); err != nil {
		return creatorProgrammeContext{}, nil, err
	}
	programmes.followers, err = affiliates.Container.Directory.FollowerCount(ctx, creatorId)
	return programmes, ordered, err
}

var accessRank = map[creatoraffiliation.Status]int{creatoraffiliation.StatusActive: 4, creatoraffiliation.StatusPaused: 3, creatoraffiliation.StatusRequested: 2, creatoraffiliation.StatusDeclined: 1}

func (programmes creatorProgrammeContext) accessFor(storeId, productId string) string {
	best := creatoraffiliation.Status("")
	for _, affiliation := range programmes.affiliations {
		if affiliation.StoreID == storeId && (affiliation.ProductID == "" || affiliation.ProductID == productId) && accessRank[affiliation.Status] > accessRank[best] {
			best = affiliation.Status
		}
	}
	switch best {
	case creatoraffiliation.StatusActive:
		return "approved"
	case creatoraffiliation.StatusPaused:
		return "paused"
	case creatoraffiliation.StatusRequested:
		return "requested"
	}
	settings := programmes.settings[storeId]
	if settings == nil {
		return "closed"
	}
	if threshold := settings.AutoApproveFollowersAbove; threshold != nil && programmes.followers > *threshold {
		return "open"
	}
	return "approval_required"
}

func accessMatches(filter, access string) bool {
	switch filter {
	case "approved":
		return access == "approved"
	case "requestable":
		return access == "open" || access == "approval_required"
	case "requested":
		return access == "requested"
	}
	return true
}

func (affiliates Affiliates) ListPromotableProducts(ctx context.Context, creatorId string, filter CatalogFilter) ([]PromotableProductView, string, error) {
	if _, approved, err := affiliates.Program.ApprovedCreatorShare(ctx, affiliates.Container.Resources.Database, creatorId); err != nil || !approved {
		if err == nil {
			err = ErrCreatorOnly
		}
		return nil, "", err
	}
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	programmes, storeIds, err := affiliates.loadCreatorProgrammes(ctx, client, creatorId, filter.StoreId)
	if err != nil {
		return nil, "", err
	}
	offset, _ := strconv.Atoi(filter.Cursor)
	products, err := affiliates.Container.Directory.ListPromotableProducts(ctx, repositories.PromotableProductFilter{StoresByPriority: storeIds, Search: filter.Search, Sort: filter.Sort, Offset: offset, Limit: filter.Limit})
	if err != nil {
		return nil, "", err
	}
	views, err := affiliates.presentPromotableProducts(ctx, client, creatorId, programmes, products)
	if err != nil {
		return nil, "", err
	}
	kept := []PromotableProductView{}
	for _, view := range views {
		if accessMatches(filter.Access, view.Access) {
			kept = append(kept, view)
		}
	}
	if filter.Sort == "commission" {
		sort.SliceStable(kept, func(left, right int) bool {
			return kept[left].CommissionBasisPoints > kept[right].CommissionBasisPoints
		})
	}
	next := ""
	if len(products) == filter.Limit {
		next = strconv.Itoa(offset + len(products))
	}
	return kept, next, nil
}

func (affiliates Affiliates) presentPromotableProducts(ctx context.Context, client *ent.Client, creatorId string, programmes creatorProgrammeContext, products []repositories.PromotableProduct) ([]PromotableProductView, error) {
	ids := make([]string, 0, len(products))
	for _, product := range products {
		ids = append(ids, product.Id)
	}
	overrides, err := client.AffiliateProductCommission.Query().Where(affiliateproductcommission.ProductIDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	byProduct := map[string]*ent.AffiliateProductCommission{}
	for _, override := range overrides {
		byProduct[override.StoreID+":"+override.ProductID] = override
	}
	links, err := client.AffiliateLink.Query().Where(affiliatelink.CreatorID(creatorId), affiliatelink.ProductIDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	linkByProduct := map[string]AffiliateLinkView{}
	for _, link := range links {
		linkByProduct[link.ProductID] = presentLink(link)
	}
	views := []PromotableProductView{}
	for _, product := range products {
		settings := programmes.settings[product.StoreId]
		if settings == nil {
			continue
		}
		bps := EffectiveBps(settings.DefaultCommissionBps, byProduct[product.StoreId+":"+product.Id], affiliates.MaximumBps())
		if bps <= 0 {
			continue
		}
		view := PromotableProductView{ProductId: product.Id, Name: product.Name, ImageUrl: product.ImageUrl, Price: Money{product.PriceMinor, product.Currency}, Stock: product.Stock,
			Store: programmes.stores[product.StoreId], CommissionBasisPoints: bps, CommissionPercent: float64(bps) / 100, EstimatedCommission: Money{ShareOf(product.PriceMinor, bps), product.Currency},
			Access: programmes.accessFor(product.StoreId, product.Id), Programme: programmeTerms(settings, affiliates.MaximumBps())}
		if link, found := linkByProduct[product.Id]; found {
			view.Link = &link
		}
		views = append(views, view)
	}
	return views, nil
}
