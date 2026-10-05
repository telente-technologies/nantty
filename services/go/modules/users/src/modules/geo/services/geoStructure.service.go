package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/geocity"
	"zudomart/modules/users/src/generated/ent/geocountry"
	"zudomart/modules/users/src/generated/ent/georegion"
	"zudomart/modules/users/src/modules/geo/constants"
)

func DescribeCountryLevels(country *ent.GeoCountry, hasCitiesUnderAdminAreas bool) []string {
	levels := []string{}
	if country.RegionLabel != nil {
		levels = append(levels, constants.LevelState)
	}
	if country.AdminAreaLabel != nil {
		levels = append(levels, constants.LevelLga)
		if hasCitiesUnderAdminAreas {
			levels = append(levels, constants.LevelCity)
		}
	}
	return levels
}

func FindCountriesWithCitiesUnderAdminAreas(ctx context.Context, client *ent.Client) (map[uuid.UUID]bool, error) {
	var cityRegions []struct {
		RegionId uuid.UUID `json:"region_id"`
	}
	if err := client.GeoCity.Query().Where(geocity.AdminAreaIDNotNil()).Unique(true).Select(geocity.FieldRegionID).Scan(ctx, &cityRegions); err != nil {
		return nil, err
	}
	regionIds := make([]uuid.UUID, 0, len(cityRegions))
	for _, row := range cityRegions {
		regionIds = append(regionIds, row.RegionId)
	}
	var regionCountries []struct {
		CountryId uuid.UUID `json:"country_id"`
	}
	err := client.GeoRegion.Query().Where(georegion.IDIn(regionIds...)).Unique(true).Select(georegion.FieldCountryID).Scan(ctx, &regionCountries)
	found := make(map[uuid.UUID]bool, len(regionCountries))
	for _, row := range regionCountries {
		found[row.CountryId] = true
	}
	return found, err
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
