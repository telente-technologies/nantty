package utils

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/jwtauth"
	"zudomart/platform/regionpricing"
)

type ProfileCountryLookup func(ctx context.Context, accountId string) string

type RegionHeaderCurrencyResolver struct {
	DefaultCurrency      string
	TrustedCountryHeader string
	AccessVerifier       *jwtauth.AccessTokenVerifier
	ProfileCountry       ProfileCountryLookup
}

// ResolveViewerCurrency is for display only (wallet balances), so an explicit ?currency choice is honoured.
func (resolver RegionHeaderCurrencyResolver) ResolveViewerCurrency(request *http.Request) string {
	if requested := strings.ToUpper(request.URL.Query().Get("currency")); regionpricing.IsSupportedCurrency(requested) {
		return requested
	}
	return resolver.ResolvePricingRegion(request).Currency
}

// ResolvePricingRegion decides what the viewer pays: storefront (apps) > profile country > CDN country > client hint > US/USD.
// It never reads ?currency, so a buyer can't pick a cheaper region's prices.
func (resolver RegionHeaderCurrencyResolver) ResolvePricingRegion(request *http.Request) regionpricing.Resolution {
	profileCountry := ""
	if userId := ledgerutils.ReadOptionalPrincipalUserId(request, resolver.AccessVerifier); userId != "" && resolver.ProfileCountry != nil {
		profileCountry = resolver.ProfileCountry(request.Context(), userId)
	}
	return regionpricing.ResolvePricingRegion(regionpricing.ReadSignalsFromRequest(request, resolver.TrustedCountryHeader, profileCountry))
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
