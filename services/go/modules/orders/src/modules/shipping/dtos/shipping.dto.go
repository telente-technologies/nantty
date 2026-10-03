package dtos

type DestinationRequest struct {
	Level       string  `json:"level"`
	CountryCode string  `json:"countryCode"`
	StateCode   *string `json:"stateCode"`
	LgaName     *string `json:"lgaName"`
	RegionId    *string `json:"regionId"`
	AdminAreaId *string `json:"adminAreaId"`
}

type RuleRequest struct {
	ZoneName     *string               `json:"zoneName"`
	Destinations *[]DestinationRequest `json:"destinations"`
	Type         *string               `json:"type"`
	FeeMinor     *int64                `json:"feeMinor"`
	Active       *bool                 `json:"active"`
}

type ProfilePatchRequest struct {
	FreeShippingThresholdMinor **int64 `json:"freeShippingThresholdMinor"`
}
