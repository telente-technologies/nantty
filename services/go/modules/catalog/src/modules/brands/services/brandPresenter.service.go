package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/catalogfollow"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/types"
)

type Verification struct {
	Status       string `json:"status"`
	Type         string `json:"type"`
	Color        string `json:"color"`
	Tier         string `json:"tier"`
	BadgeVisible bool   `json:"badgeVisible"`
}

type BrandSummary struct {
	Id              string        `json:"id"`
	Name            string        `json:"name"`
	Handle          string        `json:"handle"`
	Slug            string        `json:"slug"`
	LogoUrl         *string       `json:"logoUrl"`
	Official        bool          `json:"official"`
	Verification    *Verification `json:"verification"`
	Followers       int           `json:"followers"`
	OfficialStoreId *string       `json:"officialStoreId"`
}

type BrandDetail struct {
	BrandSummary
	CoverUrl      *string                 `json:"coverUrl"`
	CategoryName  string                  `json:"categoryName"`
	Description   string                  `json:"description"`
	Website       *string                 `json:"website"`
	IsFollowing   bool                    `json:"isFollowing"`
	OwnerUserId   *string                 `json:"ownerUserId"`
	OfficialStore *types.StoreSummaryView `json:"officialStore"`
}

func OfficialStores(ctx context.Context, deployed *container.Container, brandIds []uuid.UUID) (map[uuid.UUID]*ent.Store, error) {
	rows, err := deployed.Client.Store.Query().Where(store.BrandIDIn(brandIds...), store.HasOfficialBadge(true), store.Status(enums.StoreActive)).Order(ent.Asc(store.FieldCreatedAt)).All(ctx)
	found := map[uuid.UUID]*ent.Store{}
	for _, row := range rows {
		if _, seen := found[*row.BrandID]; !seen {
			found[*row.BrandID] = row
		}
	}
	return found, err
}

func Summarize(row *ent.Brand, official *ent.Store) BrandSummary {
	summary := BrandSummary{Id: row.ID.String(), Name: row.Name, Handle: row.Slug, Slug: row.Slug, LogoUrl: row.LogoURL, Official: row.OfficialStatus == "OFFICIAL", Followers: row.FollowerCount}
	if summary.Official {
		summary.Verification = &Verification{Status: "active", Type: "business", Color: "gold", Tier: "OFFICIAL", BadgeVisible: true}
	}
	if official != nil {
		storeId := official.ID.String()
		summary.OfficialStoreId = &storeId
	}
	return summary
}

func SummarizeAll(ctx context.Context, deployed *container.Container, rows []*ent.Brand) ([]BrandSummary, error) {
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ID)
	}
	officials, err := OfficialStores(ctx, deployed, identifiers)
	if err != nil {
		return nil, err
	}
	summaries := make([]BrandSummary, 0, len(rows))
	for _, row := range rows {
		summaries = append(summaries, Summarize(row, officials[row.ID]))
	}
	return summaries, nil
}

func Detail(ctx context.Context, deployed *container.Container, row *ent.Brand, viewer *uuid.UUID) (BrandDetail, error) {
	officials, err := OfficialStores(ctx, deployed, []uuid.UUID{row.ID})
	if err != nil {
		return BrandDetail{}, err
	}
	detail := BrandDetail{BrandSummary: Summarize(row, officials[row.ID]), CoverUrl: row.CoverURL, CategoryName: row.CategoryName, Description: row.Description, Website: row.Website}
	if row.OwnerAccountID != nil {
		owner := row.OwnerAccountID.String()
		detail.OwnerUserId = &owner
	}
	if official := officials[row.ID]; official != nil {
		summaries, err := loadStoreSummaries(ctx, deployed, official)
		if err != nil {
			return detail, err
		}
		detail.OfficialStore = &summaries
	}
	if viewer != nil {
		detail.IsFollowing, err = deployed.Client.CatalogFollow.Query().Where(catalogfollow.TargetKind("brand"), catalogfollow.TargetID(row.ID), catalogfollow.AccountID(*viewer)).Exist(ctx)
	}
	return detail, err
}
