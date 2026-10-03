package types

import (
	"time"

	"zudomart/platform/money"
)

type ShippingDestinationView struct {
	Id          string  `json:"id,omitempty"`
	Level       string  `json:"level"`
	CountryCode string  `json:"countryCode"`
	StateCode   *string `json:"stateCode"`
	LgaName     *string `json:"lgaName"`
	RegionId    *string `json:"regionId"`
	AdminAreaId *string `json:"adminAreaId"`
}

type ShippingZoneView struct {
	Id           string                    `json:"id"`
	Name         string                    `json:"name"`
	Destinations []ShippingDestinationView `json:"destinations"`
}

type ShippingRuleView struct {
	Id     string      `json:"id"`
	ZoneId string      `json:"zoneId"`
	Type   string      `json:"type"`
	Fee    money.Money `json:"fee"`
	Active bool        `json:"active"`
}

type ShippingProfileView struct {
	Id                    string             `json:"id"`
	Name                  string             `json:"name"`
	IsDefault             bool               `json:"isDefault"`
	Currency              string             `json:"currency"`
	PricedPer             string             `json:"pricedPer"`
	FreeShippingThreshold *money.Money       `json:"freeShippingThreshold"`
	Zones                 []ShippingZoneView `json:"zones"`
	Rules                 []ShippingRuleView `json:"rules"`
	UpdatedAt             time.Time          `json:"updatedAt"`
}

type ShippingCalculationView struct {
	Outcome          string       `json:"outcome"`
	Fee              money.Money  `json:"fee"`
	RuleId           *string      `json:"ruleId"`
	ZoneName         string       `json:"zoneName"`
	MatchedLevel     string       `json:"matchedLevel"`
	ThresholdApplied *money.Money `json:"thresholdApplied"`
}
