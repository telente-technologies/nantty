package validators

import (
	"strconv"

	"nantty/modules/orders/src/modules/shipping/dtos"
	"nantty/modules/orders/src/utils"
)

func ValidateRule(body dtos.RuleRequest, creating bool) error {
	var collected utils.Issues
	if creating && (body.ZoneName == nil || body.Destinations == nil || body.Type == nil) {
		collected.Add("zoneName", "zoneName, destinations and type are required")
	}
	if body.ZoneName != nil {
		collected.CheckLength("zoneName", *body.ZoneName, 2, 60)
	}
	if body.Type != nil && *body.Type != "flat_fee" && *body.Type != "free" {
		collected.Add("type", "must be flat_fee or free")
	}
	if body.FeeMinor != nil && (*body.FeeMinor < 0 || *body.FeeMinor > 100_000_000) {
		collected.Add("feeMinor", "must be between 0 and 100000000")
	}
	if body.Destinations != nil {
		if len(*body.Destinations) < 1 || len(*body.Destinations) > 100 {
			collected.Add("destinations", "must contain 1 to 100 destinations")
		}
		for index, destination := range *body.Destinations {
			path := "destinations." + strconv.Itoa(index)
			if len(destination.CountryCode) != 2 {
				collected.Add(path+".countryCode", "must be a two-letter country code")
			}
			for field, value := range map[string]*string{"regionId": destination.RegionId, "adminAreaId": destination.AdminAreaId} {
				if value != nil {
					utils.ParseIdentifier(path+"."+field, *value, &collected)
				}
			}
		}
	}
	return collected.AsError()
}

func ValidateCreateRule(body dtos.RuleRequest) error { return ValidateRule(body, true) }
func ValidateUpdateRule(body dtos.RuleRequest) error { return ValidateRule(body, false) }

func ValidateProfilePatch(body dtos.ProfilePatchRequest) error {
	var collected utils.Issues
	if body.FreeShippingThresholdMinor != nil && *body.FreeShippingThresholdMinor != nil && **body.FreeShippingThresholdMinor <= 0 {
		collected.Add("freeShippingThresholdMinor", "must be above zero, or null to turn the threshold off")
	}
	return collected.AsError()
}
