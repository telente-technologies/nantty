package validators

import (
	"strconv"
	"strings"

	"zudomart/modules/orders/src/modules/deliveryAreas/dtos"
	"zudomart/modules/orders/src/utils"
)

func ValidateDeliveryAreaValues(values dtos.DeliveryAreaValues) error {
	var collected utils.Issues
	collected.CheckLength("name", values.Name, 2, 60)
	collected.CheckLength("state", values.State, 2, 40)
	if len(values.Cities) < 1 || len(values.Cities) > 40 {
		collected.Add("cities", "must list between 1 and 40 cities")
	}
	seen := map[string]bool{}
	for index, city := range values.Cities {
		key := strings.ToLower(strings.TrimSpace(city))
		if key == "" || len(city) > 60 {
			collected.Add("cities."+strconv.Itoa(index), "must be a city name")
		} else if seen[key] {
			collected.Add("cities."+strconv.Itoa(index), "is listed twice")
		}
		seen[key] = true
	}
	if values.FeeMinor < 0 || values.FeeMinor > 100_000_000 {
		collected.Add("feeMinor", "must be between 0 and 100000000")
	}
	collected.CheckRange("estimatedDaysMin", values.EstimatedDaysMin, 0, 30)
	collected.CheckRange("estimatedDaysMax", values.EstimatedDaysMax, 0, 30)
	if values.EstimatedDaysMax < values.EstimatedDaysMin {
		collected.Add("estimatedDaysMax", "must be at least the minimum")
	}
	return collected.AsError()
}

func ValidateNewDeliveryArea(input dtos.DeliveryAreaInput) error {
	if !input.IsComplete() {
		var collected utils.Issues
		collected.Add("body", "must include name, state, cities, feeMinor, estimatedDaysMin, estimatedDaysMax and active")
		return collected.AsError()
	}
	return ValidateDeliveryAreaValues(input.MergedOver(dtos.DeliveryAreaValues{}))
}

func AcceptPartialDeliveryArea(dtos.DeliveryAreaInput) error { return nil }
