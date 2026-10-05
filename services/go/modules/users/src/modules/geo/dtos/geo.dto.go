package dtos

import (
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/geo/services"
)

type GeoCountryResponse struct {
	Id         string   `json:"id"`
	Code       string   `json:"code"`
	Name       string   `json:"name"`
	Currency   string   `json:"currency"`
	Levels     []string `json:"levels"`
	StateLabel string   `json:"stateLabel"`
	LgaLabel   string   `json:"lgaLabel"`
}

type GeoAreaResponse struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	ParentId string `json:"parentId"`
}

func ConvertCountryToResponse(country *ent.GeoCountry, hasCities bool) GeoCountryResponse {
	response := GeoCountryResponse{Id: country.ID.String(), Code: country.Code, Name: country.Name, Currency: services.CurrencyForCountry(country), Levels: services.DescribeCountryLevels(country, hasCities)}
	if country.RegionLabel != nil {
		response.StateLabel = *country.RegionLabel
	}
	if country.AdminAreaLabel != nil {
		response.LgaLabel = *country.AdminAreaLabel
	}
	return response
}
