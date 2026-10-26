package dtos

import (
	"time"

	"nantty/modules/users/src/modules/addresses/services"
)

type AddressRequest struct {
	Label      *string `json:"label"`
	FullName   *string `json:"fullName"`
	Phone      *string `json:"phone"`
	Line1      *string `json:"line1"`
	Line2      *string `json:"line2"`
	PostalCode *string `json:"postalCode"`
	Details    *string `json:"details"`
	IsDefault  *bool   `json:"isDefault"`
	CountryId  *string `json:"countryId"`
	StateId    *string `json:"stateId"`
	LgaId      *string `json:"lgaId"`
	CityId     *string `json:"cityId"`
	City       *string `json:"city"`
	State      *string `json:"state"`
}

type AddressResponse struct {
	Id          string  `json:"id"`
	Label       string  `json:"label"`
	FullName    string  `json:"fullName"`
	Phone       string  `json:"phone"`
	Line1       string  `json:"line1"`
	Line2       string  `json:"line2"`
	PostalCode  string  `json:"postalCode"`
	Details     string  `json:"details"`
	IsDefault   bool    `json:"isDefault"`
	CountryId   string  `json:"countryId"`
	CountryCode string  `json:"countryCode"`
	Country     string  `json:"country"`
	StateId     *string `json:"stateId"`
	State       string  `json:"state"`
	LgaId       *string `json:"lgaId"`
	Lga         *string `json:"lga"`
	CityId      *string `json:"cityId"`
	City        string  `json:"city"`
	Display     string  `json:"display"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

func ConvertViewToResponse(view services.AddressView) AddressResponse {
	address := view.Address
	response := AddressResponse{
		Id: address.ID.String(), Label: address.Label, FullName: address.RecipientName, Phone: view.Phone, Line1: address.Line1, Line2: address.Line2,
		PostalCode: address.PostalCode, Details: address.Details, IsDefault: address.IsDefault, CountryCode: address.CountryCode,
		State: view.StateName(), City: view.CityName(), Display: view.DisplayLine(),
		CreatedAt: address.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: address.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if view.Country != nil {
		response.CountryId, response.Country = view.Country.ID.String(), view.Country.Name
	}
	if view.Region != nil {
		response.StateId = identifierText(view.Region.ID.String())
	}
	if view.Area != nil {
		response.LgaId, response.Lga = identifierText(view.Area.ID.String()), identifierText(view.Area.Name)
	}
	if view.City != nil {
		response.CityId = identifierText(view.City.ID.String())
	}
	return response
}

func identifierText(value string) *string { return &value }
