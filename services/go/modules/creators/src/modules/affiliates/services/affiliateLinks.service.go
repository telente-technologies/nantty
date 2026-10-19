package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliatelink"
	"zudomart/modules/creators/src/generated/ent/creatoraffiliation"
	"zudomart/platform/httpserver"
)

var (
	ErrAffiliationPending   = httpserver.NewApiError(http.StatusConflict, "AFFILIATION_PENDING", "The seller has to approve you before you can share this product.")
	ErrProductNotPromotable = httpserver.NewApiError(http.StatusConflict, "PRODUCT_NOT_PROMOTABLE", "This product isn't open to affiliates.")
	ErrAffiliateLinkMissing = httpserver.NewApiError(http.StatusNotFound, "LINK_NOT_FOUND", "This link doesn't exist.")
)

type AffiliateLinkView struct {
	Id        string    `json:"id"`
	ProductId string    `json:"productId"`
	StoreId   string    `json:"storeId"`
	Path      string    `json:"path"`
	Clicks    int64     `json:"clicks"`
	CreatedAt time.Time `json:"createdAt"`
}

type SaleAttributionView struct {
	Source string `json:"source"`
	Id     string `json:"id"`
}

type AffiliateLinkClickView struct {
	ProductId             string              `json:"productId"`
	Attribution           SaleAttributionView `json:"attribution"`
	AttributionWindowDays int                 `json:"attributionWindowDays"`
	ExpiresAt             time.Time           `json:"expiresAt"`
}

func presentLink(link *ent.AffiliateLink) AffiliateLinkView {
	return AffiliateLinkView{Id: link.ID.String(), ProductId: link.ProductID, StoreId: link.StoreID, Path: "/p/" + link.ProductID + "?aff=" + link.ID.String(), Clicks: link.Clicks, CreatedAt: link.CreatedAt}
}

func (affiliates Affiliates) activeAffiliationCovers(ctx context.Context, client *ent.Client, creatorId, storeId, productId string) (bool, error) {
	return client.CreatorAffiliation.Query().Where(creatoraffiliation.CreatorID(creatorId), creatoraffiliation.StoreID(storeId),
		creatoraffiliation.StatusEQ(creatoraffiliation.StatusActive), creatoraffiliation.ProductIDIn("", productId)).Exist(ctx)
}

// CreateAffiliateLink gives the creator one attributed link per product. Without an approved affiliation it files the
// request first; when the store auto-approves the creator the link is issued straight away.
func (affiliates Affiliates) CreateAffiliateLink(ctx context.Context, creatorId, productId string) (AffiliateLinkView, error) {
	products, err := affiliates.Container.Directory.FindProducts(ctx, []string{productId})
	if err != nil {
		return AffiliateLinkView{}, err
	}
	product, found := products[productId]
	if !found || !product.Published {
		return AffiliateLinkView{}, ErrProductNotFound
	}
	rates, err := affiliates.CommissionRates(ctx, product.StoreId, []string{productId})
	if err != nil {
		return AffiliateLinkView{}, err
	}
	if rates[productId] <= 0 {
		return AffiliateLinkView{}, ErrProductNotPromotable
	}
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	covered, err := affiliates.activeAffiliationCovers(ctx, client, creatorId, product.StoreId, productId)
	if err != nil {
		return AffiliateLinkView{}, err
	}
	if !covered {
		requested, err := affiliates.RequestAffiliation(ctx, AffiliationRequest{CreatorId: creatorId, ProductId: productId})
		if errors.Is(err, ErrAlreadyAffiliated) || (err == nil && requested.Status != "active") {
			return AffiliateLinkView{}, ErrAffiliationPending
		}
		if err != nil {
			return AffiliateLinkView{}, err
		}
	}
	err = client.AffiliateLink.Create().SetID(uuid.Must(uuid.NewV7())).SetCreatorID(creatorId).SetStoreID(product.StoreId).SetProductID(productId).
		SetCreatedAt(affiliates.Container.Now().UTC()).OnConflictColumns(affiliatelink.FieldCreatorID, affiliatelink.FieldProductID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return AffiliateLinkView{}, err
	}
	link, err := client.AffiliateLink.Query().Where(affiliatelink.CreatorID(creatorId), affiliatelink.ProductID(productId)).Only(ctx)
	if err != nil {
		return AffiliateLinkView{}, err
	}
	return presentLink(link), nil
}
