package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/geoadminarea"
	"nantty/modules/users/src/generated/ent/geocity"
	"nantty/modules/users/src/generated/ent/geocountry"
	"nantty/modules/users/src/generated/ent/georegion"
)

type AddressView struct {
	Address *ent.ShippingAddress
	Country *ent.GeoCountry
	Region  *ent.GeoRegion
	Area    *ent.GeoAdminArea
	City    *ent.GeoCity
	Phone   string
}

func (view AddressView) StateName() string {
	if view.Region != nil {
		return view.Region.Name
	}
	return view.Address.FreeTextState
}

func (view AddressView) CityName() string {
	if view.City != nil {
		return view.City.Name
	}
	return view.Address.FreeTextCity
}

func (view AddressView) DisplayLine() string {
	parts := []string{view.Address.Line1, view.Address.Line2, view.CityName()}
	if view.Area != nil {
		parts = append(parts, view.Area.Name)
	}
	parts = append(parts, view.StateName(), view.Address.PostalCode)
	if view.Country != nil {
		parts = append(parts, view.Country.Name)
	}
	kept := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			kept = append(kept, strings.TrimSpace(part))
		}
	}
	return strings.Join(kept, ", ")
}

func BuildAddressViews(ctx context.Context, client *ent.Client, phoneKey []byte, addresses []*ent.ShippingAddress) ([]AddressView, error) {
	regionIds, areaIds, cityIds, countryCodes := collectGeoIdentifiers(addresses)
	countries, err := client.GeoCountry.Query().Where(geocountry.CodeIn(countryCodes...)).All(ctx)
	if err != nil {
		return nil, err
	}
	regions, err := client.GeoRegion.Query().Where(georegion.IDIn(regionIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	areas, err := client.GeoAdminArea.Query().Where(geoadminarea.IDIn(areaIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	cities, err := client.GeoCity.Query().Where(geocity.IDIn(cityIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]AddressView, 0, len(addresses))
	for _, address := range addresses {
		view := AddressView{Address: address}
		if view.Phone, err = OpenPhone(phoneKey, address); err != nil {
			return nil, err
		}
		for _, country := range countries {
			if country.Code == address.CountryCode {
				view.Country = country
			}
		}
		view.Region = findById(regions, address.RegionID, func(region *ent.GeoRegion) uuid.UUID { return region.ID })
		view.Area = findById(areas, address.AdminAreaID, func(area *ent.GeoAdminArea) uuid.UUID { return area.ID })
		view.City = findById(cities, address.CityID, func(city *ent.GeoCity) uuid.UUID { return city.ID })
		views = append(views, view)
	}
	return views, nil
}

func collectGeoIdentifiers(addresses []*ent.ShippingAddress) (regions, areas, cities []uuid.UUID, countryCodes []string) {
	for _, address := range addresses {
		countryCodes = append(countryCodes, address.CountryCode)
		if address.RegionID != nil {
			regions = append(regions, *address.RegionID)
		}
		if address.AdminAreaID != nil {
			areas = append(areas, *address.AdminAreaID)
		}
		if address.CityID != nil {
			cities = append(cities, *address.CityID)
		}
	}
	return regions, areas, cities, countryCodes
}

func findById[Record any](records []Record, identifier *uuid.UUID, idOf func(Record) uuid.UUID) Record {
	var none Record
	if identifier == nil {
		return none
	}
	for _, record := range records {
		if idOf(record) == *identifier {
			return record
		}
	}
	return none
}
