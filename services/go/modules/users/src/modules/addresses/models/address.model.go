package models

import "github.com/google/uuid"

const MaximumAddressesPerAccount = 20

type GeoSelection struct {
	CountryIdentifier string
	StateId           *uuid.UUID
	LgaId             *uuid.UUID
	CityId            *uuid.UUID
	FreeTextCity      string
	FreeTextState     string
}

type AddressInput struct {
	Label      string
	FullName   string
	Phone      string
	Line1      string
	Line2      string
	PostalCode string
	Details    string
	IsDefault  bool
	Geo        GeoSelection
}

type AddressPatch struct {
	Label      *string
	FullName   *string
	Phone      *string
	Line1      *string
	Line2      *string
	PostalCode *string
	Details    *string
	IsDefault  *bool
	Geo        *GeoSelection
}
