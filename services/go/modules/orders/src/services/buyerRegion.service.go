package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/platform/usersdirectory"
	"nantty/platform/viewerregion"
)

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
