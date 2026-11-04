package services

import (
	"strings"

	catalogerrors "nantty/modules/catalog/src/errors"
)

func RequireNigeriaSellerMarket(countryCode string) error {
	if strings.EqualFold(strings.TrimSpace(countryCode), "NG") {
		return nil
	}
	return catalogerrors.SellerMarketUnavailable
}
