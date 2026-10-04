package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/platform/usersdirectory"
	"zudomart/platform/viewerregion"
)

// BuyerCountry prices a cart for where it is going: the delivery address wins, then profile country, the proxy-resolved IP country, and the client hint.
func BuyerCountry(ctx context.Context, deployed *container.Container, accountId uuid.UUID, address *usersdirectory.ShippingAddress) string {
	if address != nil {
		if country := viewerregion.NormalizeCountryCode(address.CountryCode); country != "" {
			return country
		}
	}
	profileCountry, _ := deployed.Users.PersonalProfileCountry(ctx, accountId)
	country, _ := viewerregion.Resolve(profileCountry, viewerregion.SignalsFromContext(ctx))
	return country
}
