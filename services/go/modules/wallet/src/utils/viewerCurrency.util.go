package utils

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/jwtauth"
	"nantty/platform/regionpricing"
)

type ProfileCountryLookup func(ctx context.Context, accountId string) string

type RegionHeaderCurrencyResolver struct {
	DefaultCurrency      string
	TrustedCountryHeader string
	AccessVerifier       *jwtauth.AccessTokenVerifier
	ProfileCountry       ProfileCountryLookup
}

func (resolver RegionHeaderCurrencyResolver) ResolveViewerCurrency(request *http.Request) string {
	if requested := strings.ToUpper(request.URL.Query().Get("currency")); regionpricing.IsSupportedCurrency(requested) {
		return requested
	}
	return resolver.ResolvePricingRegion(request).Currency
}

func (resolver RegionHeaderCurrencyResolver) ResolvePricingRegion(request *http.Request) regionpricing.Resolution {
	return regionpricing.ResolvePricingRegion(regionpricing.ReadSignalsFromRequest(request, resolver.TrustedCountryHeader, resolver.profileCountry(request)))
}

func (resolver RegionHeaderCurrencyResolver) ResolveChargingRegion(request *http.Request) regionpricing.Resolution {
	return regionpricing.ResolveChargingRegion(regionpricing.ReadSignalsFromRequest(request, resolver.TrustedCountryHeader, resolver.profileCountry(request)))
}

func (resolver RegionHeaderCurrencyResolver) profileCountry(request *http.Request) string {
	if userId := ledgerutils.ReadOptionalPrincipalUserId(request, resolver.AccessVerifier); userId != "" && resolver.ProfileCountry != nil {
		return resolver.ProfileCountry(request.Context(), userId)
	}
	return ""
}

func ProfileCountryFromUsersSchema(database *sql.DB, usersSchema string) ProfileCountryLookup {
	return func(ctx context.Context, accountId string) string {
		if database == nil || usersSchema == "" {
			return ""
		}
		var country string
		query := "SELECT COALESCE(country_code, '') FROM " + pgx.Identifier{usersSchema, "profiles"}.Sanitize() + " WHERE account_id::text = $1 AND kind = 'personal' LIMIT 1"
		if database.QueryRowContext(ctx, query, accountId).Scan(&country) != nil {
			return ""
		}
		return country
	}
}

func IsSupportedWalletCurrency(currency string) bool {
	return regionpricing.IsSupportedCurrency(currency)
}
