package services

import (
	"context"
	"slices"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/storemember"
	"nantty/platform/viewerregion"
)

func ViewerCountry(ctx context.Context, deployed *container.Container, viewer *uuid.UUID) string {
	profileCountry := ""
	if viewer != nil {
		if found, err := deployed.Users.PersonalProfileCountry(ctx, *viewer); err == nil {
			profileCountry = found
		}
	}
	country, _ := viewerregion.Resolve(profileCountry, viewerregion.SignalsFromContext(ctx))
	return country
}

func ShippingCountriesOf(row *ent.Store) []string {
	if len(row.ShippingCountryCodes) > 0 {
		return row.ShippingCountryCodes
	}
	return []string{row.CountryCode}
}

func StoreShipsTo(row *ent.Store, country string) bool {
	return country == "" || slices.Contains(ShippingCountriesOf(row), country)
}

func IsStoreStaff(ctx context.Context, deployed *container.Container, row *ent.Store, viewer *uuid.UUID) bool {
	if viewer == nil {
		return false
	}
	if row.OwnerAccountID == *viewer {
		return true
	}
	staff, err := deployed.Client.StoreMember.Query().Where(storemember.StoreID(row.ID), storemember.AccountID(*viewer)).Exist(ctx)
	return err == nil && staff
}

func StoreVisibleInRegion(ctx context.Context, deployed *container.Container, row *ent.Store, country string, viewer *uuid.UUID) bool {
	return StoreShipsTo(row, country) || IsStoreStaff(ctx, deployed, row, viewer)
}

func ShipsToCountryCondition(country string, viewer *uuid.UUID) predicate.Product {
	if country == "" {
		return nil
	}
	return predicate.Product(func(selector *sql.Selector) {
		selector.Where(sql.P(func(builder *sql.Builder) {
			builder.WriteString("EXISTS (SELECT 1 FROM stores ws WHERE ws.id = ").WriteString(selector.C(product.FieldStoreID)).WriteString(" AND (")
			builder.WriteString("ws.shipping_country_codes @> to_jsonb(").Arg(country).WriteString("::text)")
			builder.WriteString(" OR ((ws.shipping_country_codes IS NULL OR ws.shipping_country_codes = '[]'::jsonb) AND ws.country_code = ").Arg(country).WriteString(")")
			if viewer != nil {
				builder.WriteString(" OR ws.owner_account_id = ").Arg(*viewer)
				builder.WriteString(" OR EXISTS (SELECT 1 FROM store_members wm WHERE wm.store_id = ws.id AND wm.account_id = ").Arg(*viewer).WriteString(")")
			}
			builder.WriteString("))")
		}))
	})
}

func WithRegionCondition(conditions []predicate.Product, country string, viewer *uuid.UUID) []predicate.Product {
	if condition := ShipsToCountryCondition(country, viewer); condition != nil {
		return append(conditions, condition)
	}
	return conditions
}

func NormalizeShippingCountries(codes []string) []string {
	unique := map[string]bool{}
	for _, code := range codes {
		if normalized := viewerregion.NormalizeCountryCode(code); normalized != "" {
			unique[normalized] = true
		}
	}
	result := make([]string, 0, len(unique))
	for code := range unique {
		result = append(result, code)
	}
	slices.Sort(result)
	return result
}

func ListedStoreCondition() predicate.Product {
	return predicate.Product(func(selector *sql.Selector) {
		selector.Where(sql.P(func(builder *sql.Builder) {
			builder.WriteString("EXISTS (SELECT 1 FROM stores ls WHERE ls.id = ").WriteString(selector.C(product.FieldStoreID))
			builder.WriteString(" AND ls.status = 'active' AND ls.moderation_visibility IN ('visible', 'restricted'))")
		}))
	})
}
