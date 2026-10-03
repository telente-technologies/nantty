package models

type SeedCity struct {
	Name string `json:"name"`
	Area string `json:"area"`
}

type SeedRegion struct {
	Name   string     `json:"name"`
	Code   *string    `json:"code"`
	Areas  []string   `json:"areas"`
	Cities []SeedCity `json:"cities"`
}

type SeedCountry struct {
	Code               string       `json:"code"`
	Name               string       `json:"name"`
	RegionLabel        *string      `json:"regionLabel"`
	AdminAreaLabel     *string      `json:"adminAreaLabel"`
	PostalCodeRequired bool         `json:"postalCodeRequired"`
	Regions            []SeedRegion `json:"regions"`
}
