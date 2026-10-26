package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/geoadminarea"
	"nantty/modules/users/src/generated/ent/geocity"
	"nantty/modules/users/src/generated/ent/georegion"
	addressmodels "nantty/modules/users/src/modules/addresses/models"
	geoservices "nantty/modules/users/src/modules/geo/services"
	"nantty/platform/httpserver"
)

type ResolvedGeo struct {
	Country *ent.GeoCountry
	Region  *ent.GeoRegion
	Area    *ent.GeoAdminArea
	City    *ent.GeoCity
}

func geoIssue(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func ResolveGeoSelection(ctx context.Context, client *ent.Client, selection addressmodels.GeoSelection) (ResolvedGeo, error) {
	country, err := geoservices.FindCountryByIdentifier(ctx, client, selection.CountryIdentifier)
	if err != nil {
		return ResolvedGeo{}, err
	}
	if country == nil {
		return ResolvedGeo{}, geoIssue("countryId", "is not a supported country")
	}
	resolved := ResolvedGeo{Country: country}
	regionCount, err := client.GeoRegion.Query().Where(georegion.CountryID(country.ID)).Count(ctx)
	if err != nil {
		return resolved, err
	}
	if regionCount == 0 {
		return resolved, requireNoStructuredIds(selection)
	}
	if resolved.Region, err = resolveRegion(ctx, client, country, selection); err != nil {
		return resolved, err
	}
	if resolved.Area, err = resolveAdminArea(ctx, client, country, resolved.Region, selection); err != nil {
		return resolved, err
	}
	resolved.City, err = resolveCity(ctx, client, resolved.Region, resolved.Area, selection)
	return resolved, err
}

func requireNoStructuredIds(selection addressmodels.GeoSelection) error {
	if selection.StateId != nil {
		return geoIssue("stateId", "this country has no states or regions")
	}
	if selection.LgaId != nil {
		return geoIssue("lgaId", "this country has no administrative areas")
	}
	if selection.CityId != nil {
		return geoIssue("cityId", "this country has no cities")
	}
	return nil
}

func resolveRegion(ctx context.Context, client *ent.Client, country *ent.GeoCountry, selection addressmodels.GeoSelection) (*ent.GeoRegion, error) {
	if selection.StateId == nil {
		return nil, geoIssue("stateId", "is required for this country")
	}
	region, err := client.GeoRegion.Query().Where(georegion.ID(*selection.StateId), georegion.CountryID(country.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, geoIssue("stateId", "does not belong to the selected country")
	}
	return region, err
}

func resolveAdminArea(ctx context.Context, client *ent.Client, country *ent.GeoCountry, region *ent.GeoRegion, selection addressmodels.GeoSelection) (*ent.GeoAdminArea, error) {
	areaCount := 0
	if country.AdminAreaLabel != nil {
		var err error
		if areaCount, err = client.GeoAdminArea.Query().Where(geoadminarea.RegionID(region.ID)).Count(ctx); err != nil {
			return nil, err
		}
	}
	if areaCount == 0 {
		if selection.LgaId != nil {
			return nil, geoIssue("lgaId", "this region has no administrative areas")
		}
		return nil, nil
	}
	if selection.LgaId == nil {
		return nil, geoIssue("lgaId", "is required for this region")
	}
	area, err := client.GeoAdminArea.Query().Where(geoadminarea.ID(*selection.LgaId), geoadminarea.RegionID(region.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, geoIssue("lgaId", "does not belong to the selected region")
	}
	return area, err
}

func resolveCity(ctx context.Context, client *ent.Client, region *ent.GeoRegion, area *ent.GeoAdminArea, selection addressmodels.GeoSelection) (*ent.GeoCity, error) {
	if selection.CityId == nil {
		return nil, nil
	}
	city, err := client.GeoCity.Query().Where(geocity.ID(*selection.CityId), geocity.RegionID(region.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, geoIssue("cityId", "does not belong to the selected region")
	}
	if err != nil {
		return nil, err
	}
	if area != nil && city.AdminAreaID != nil && *city.AdminAreaID != area.ID {
		return nil, geoIssue("cityId", "does not belong to the selected area")
	}
	return city, nil
}

func GeoColumnsFromResolved(resolved ResolvedGeo) (region, area, city *uuid.UUID) {
	if resolved.Region != nil {
		region = &resolved.Region.ID
	}
	if resolved.Area != nil {
		area = &resolved.Area.ID
	}
	if resolved.City != nil {
		city = &resolved.City.ID
	}
	return region, area, city
}
