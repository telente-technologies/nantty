package services

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/store"
	"nantty/modules/catalog/src/generated/ent/storemember"
	"nantty/modules/catalog/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func FindStoreAccess(ctx context.Context, deployed *container.Container, accountId uuid.UUID, requested *uuid.UUID) (commerceports.StoreAccess, bool, error) {
	query := deployed.Client.StoreMember.Query().Where(storemember.AccountID(accountId), storemember.Status("active"))
	if requested != nil {
		query = query.Where(storemember.StoreID(*requested))
	}
	members, err := query.Order(ent.Asc(storemember.FieldCreatedAt)).All(ctx)
	if err != nil || len(members) == 0 {
		return commerceports.StoreAccess{}, false, err
	}
	chosen := members[0]
	for _, member := range members {
		if member.Role == "owner" {
			chosen = member
			break
		}
	}
	row, err := deployed.Client.Store.Get(ctx, chosen.StoreID)
	if err != nil {
		return commerceports.StoreAccess{}, false, err
	}
	markMemberActive(ctx, deployed, chosen)
	return commerceports.StoreAccess{
		StoreId: row.ID, OwnerAccountId: row.OwnerAccountID, Role: chosen.Role, Permissions: chosen.Permissions,
		Currency: money.CurrencyCode(row.Currency), CountryCode: row.CountryCode, StoreStatus: row.Status, StoreName: row.Name, Timezone: row.Timezone,
	}, row.Status != "closed", nil
}

func ListStoreTeamWithPermission(ctx context.Context, deployed *container.Container, storeId uuid.UUID, permission string) ([]uuid.UUID, error) {
	members, err := deployed.Client.StoreMember.Query().Where(storemember.StoreID(storeId), storemember.Status("active")).Order(ent.Asc(storemember.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	seen := map[uuid.UUID]bool{}
	accountIds := []uuid.UUID{}
	for _, member := range members {
		if seen[member.AccountID] || !commerceports.RoleAllows(member.Role, member.Permissions, permission) {
			continue
		}
		seen[member.AccountID] = true
		accountIds = append(accountIds, member.AccountID)
	}
	return accountIds, nil
}

var nonSlugCharacters = regexp.MustCompile(`[^a-z0-9]+`)

func Slugify(text string) string {
	slug := strings.Trim(nonSlugCharacters.ReplaceAllString(strings.ToLower(text), "-"), "-")
	if len(slug) > 50 {
		slug = strings.Trim(slug[:50], "-")
	}
	if slug == "" {
		return "item"
	}
	return slug
}

var currencyByCountry = map[string]string{
	"NG": "NGN", "GH": "GHS", "KE": "KES", "ZA": "ZAR", "GB": "GBP", "US": "USD",
	"DE": "EUR", "FR": "EUR", "IE": "EUR", "ES": "EUR", "IT": "EUR", "NL": "EUR", "PT": "EUR", "BE": "EUR",
}

func CurrencyForCountry(countryCode string) (string, bool) {
	currency, found := currencyByCountry[strings.ToUpper(countryCode)]
	return currency, found
}

func StoreExistsWithSlug(ctx context.Context, deployed *container.Container, slug string) (bool, error) {
	return deployed.Client.Store.Query().Where(store.Slug(slug)).Exist(ctx)
}

func UniqueIdentifiers[Row any](rows []Row, identifierOf func(Row) uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifier := identifierOf(row)
		if !seen[identifier] {
			seen[identifier] = true
			identifiers = append(identifiers, identifier)
		}
	}
	return identifiers
}

func CategoryViewOf(row *ent.Category) types.CategoryView {
	return types.CategoryView{
		Id: row.ID.String(), Name: row.Name, Description: row.Description, ParentId: idString(row.ParentID), Slug: row.Slug, Depth: row.Depth, StoreId: idString(row.StoreID),
	}
}

func markMemberActive(ctx context.Context, deployed *container.Container, member *ent.StoreMember) {
	now := deployed.Now()
	if member.LastActiveAt != nil && now.Sub(*member.LastActiveAt) < 10*time.Minute {
		return
	}
	_ = deployed.Client.StoreMember.UpdateOneID(member.ID).SetLastActiveAt(now).Exec(ctx)
}
