package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/geocountry"
	"zudomart/modules/users/src/modules/geo/constants"
)

func DescribeCountryLevels(country *ent.GeoCountry) []string {
	levels := []string{}
	if country.RegionLabel != nil {
		levels = append(levels, constants.LevelState)
	}
	if country.AdminAreaLabel != nil {
		levels = append(levels, constants.LevelLga)
	}
	return levels
}

func CurrencyForCountry(country *ent.GeoCountry) string {
	if currency, found := constants.CurrencyByCountryCode[country.Code]; found {
		return currency
	}
	return "USD"
}

func FindCountryByIdentifier(ctx context.Context, client *ent.Client, identifier string) (*ent.GeoCountry, error) {
	predicate := geocountry.Code(strings.ToUpper(strings.TrimSpace(identifier)))
	if parsed, err := uuid.Parse(identifier); err == nil {
		predicate = geocountry.ID(parsed)
	}
	country, err := client.GeoCountry.Query().Where(predicate).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return country, err
}
