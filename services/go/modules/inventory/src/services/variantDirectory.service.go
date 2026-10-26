package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/platform/commerceports"
)

func DescribeVariantsOfStore(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID]commerceports.VariantDescription, error) {
	catalog, err := commerceports.Default.CatalogReader()
	if err != nil {
		return nil, err
	}
	return catalog.DescribeVariants(ctx, storeId, variantIds)
}

func UniqueVariantIds[Row any](rows []Row, variantOf func(Row) uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifier := variantOf(row)
		if !seen[identifier] {
			seen[identifier] = true
			identifiers = append(identifiers, identifier)
		}
	}
	return identifiers
}

func ActorDisplayName(ctx context.Context, deployed *container.Container, accountId uuid.UUID) string {
	profiles, err := deployed.Users.PersonalProfilesByAccount(ctx, []uuid.UUID{accountId})
	if err != nil || profiles[accountId].Name == "" {
		return ""
	}
	return profiles[accountId].Name
}

func PeopleNames(ctx context.Context, deployed *container.Container, accountIds []uuid.UUID) map[uuid.UUID]string {
	profiles, err := deployed.Users.PersonalProfilesByAccount(ctx, accountIds)
	names := map[uuid.UUID]string{}
	if err != nil {
		return names
	}
	for accountId, profile := range profiles {
		names[accountId] = profile.Name
	}
	return names
}
