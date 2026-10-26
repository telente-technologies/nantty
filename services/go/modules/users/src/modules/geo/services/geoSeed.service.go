package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/geoadminarea"
	"nantty/modules/users/src/generated/ent/geocity"
	"nantty/modules/users/src/generated/ent/geocountry"
	"nantty/modules/users/src/generated/ent/georegion"
	"nantty/modules/users/src/modules/geo/constants"
	"nantty/modules/users/src/modules/geo/models"
)

const seedBatchSize = 200

func ReadEmbeddedSeedCountries() ([]models.SeedCountry, error) {
	var countries []models.SeedCountry
	for _, name := range constants.SeedFileNames {
		raw, err := constants.GeoSeedFiles.ReadFile(name)
		if err != nil {
			return nil, err
		}
		var chunk []models.SeedCountry
		if err := json.Unmarshal(raw, &chunk); err != nil {
			return nil, fmt.Errorf("parse %s: %w", name, err)
		}
		countries = append(countries, chunk...)
	}
	return countries, nil
}

func SeedGeoReferenceDataIfMissing(ctx context.Context, client *ent.Client) error {
	countries, err := ReadEmbeddedSeedCountries()
	if err != nil {
		return err
	}
	for _, seedCountry := range countries {
		country, err := findOrCreateCountry(ctx, client, seedCountry)
		if err != nil {
			return err
		}
		if err := seedRegionsOfCountry(ctx, client, country, seedCountry.Regions); err != nil {
			return fmt.Errorf("seed %s: %w", seedCountry.Code, err)
		}
	}
	return nil
}

func findOrCreateCountry(ctx context.Context, client *ent.Client, seed models.SeedCountry) (*ent.GeoCountry, error) {
	existing, err := client.GeoCountry.Query().Where(geocountry.Code(seed.Code)).Only(ctx)
	if err == nil || !ent.IsNotFound(err) {
		return existing, err
	}
	return client.GeoCountry.Create().SetCode(seed.Code).SetName(seed.Name).SetNillableRegionLabel(seed.RegionLabel).
		SetNillableAdminAreaLabel(seed.AdminAreaLabel).SetPostalCodeRequired(seed.PostalCodeRequired).Save(ctx)
}

func seedRegionsOfCountry(ctx context.Context, client *ent.Client, country *ent.GeoCountry, seeds []models.SeedRegion) error {
	existing, err := client.GeoRegion.Query().Where(georegion.CountryID(country.ID)).All(ctx)
	if err != nil {
		return err
	}
	regionsByName := map[string]*ent.GeoRegion{}
	for _, region := range existing {
		regionsByName[region.Name] = region
	}
	var missing []*ent.GeoRegionCreate
	var missingNames []string
	for _, seed := range seeds {
		if _, found := regionsByName[seed.Name]; !found {
			missing = append(missing, client.GeoRegion.Create().SetCountryID(country.ID).SetCountryCode(country.Code).SetName(seed.Name).SetNillableCode(seed.Code))
			missingNames = append(missingNames, seed.Name)
		}
	}
	created, err := client.GeoRegion.CreateBulk(missing...).Save(ctx)
	if err != nil {
		return err
	}
	for index, region := range created {
		regionsByName[missingNames[index]] = region
	}
	for _, seed := range seeds {
		if err := seedAreasAndCitiesOfRegion(ctx, client, regionsByName[seed.Name], seed); err != nil {
			return fmt.Errorf("region %s: %w", seed.Name, err)
		}
	}
	return nil
}

func seedAreasAndCitiesOfRegion(ctx context.Context, client *ent.Client, region *ent.GeoRegion, seed models.SeedRegion) error {
	areaIdsByName, err := seedAreasOfRegion(ctx, client, region.ID, seed.Areas)
	if err != nil {
		return err
	}
	existingCities, err := client.GeoCity.Query().Where(geocity.RegionID(region.ID)).All(ctx)
	if err != nil {
		return err
	}
	known := map[string]bool{}
	for _, city := range existingCities {
		known[city.Name] = true
	}
	var missing []*ent.GeoCityCreate
	for _, city := range seed.Cities {
		if known[city.Name] {
			continue
		}
		create := client.GeoCity.Create().SetRegionID(region.ID).SetName(city.Name)
		if city.Area != "" {
			areaId, found := areaIdsByName[city.Area]
			if !found {
				return fmt.Errorf("city %s references unknown area %s", city.Name, city.Area)
			}
			create.SetAdminAreaID(areaId)
		}
		missing = append(missing, create)
	}
	return client.GeoCity.CreateBulk(missing...).Exec(ctx)
}

func seedAreasOfRegion(ctx context.Context, client *ent.Client, regionId uuid.UUID, names []string) (map[string]uuid.UUID, error) {
	existing, err := client.GeoAdminArea.Query().Where(geoadminarea.RegionID(regionId)).All(ctx)
	if err != nil {
		return nil, err
	}
	idsByName := map[string]uuid.UUID{}
	for _, area := range existing {
		idsByName[area.Name] = area.ID
	}
	var missing []*ent.GeoAdminAreaCreate
	var missingNames []string
	for _, name := range names {
		if _, found := idsByName[name]; !found {
			missing = append(missing, client.GeoAdminArea.Create().SetRegionID(regionId).SetName(name))
			missingNames = append(missingNames, name)
		}
	}
	for start := 0; start < len(missing); start += seedBatchSize {
		created, err := client.GeoAdminArea.CreateBulk(missing[start:min(start+seedBatchSize, len(missing))]...).Save(ctx)
		if err != nil {
			return nil, err
		}
		for offset, area := range created {
			idsByName[missingNames[start+offset]] = area.ID
		}
	}
	return idsByName, nil
}
