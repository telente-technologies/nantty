package validators

import (
	"slices"
	"strconv"
	"strings"

	"nantty/modules/inventory/src/enums"
	"nantty/modules/inventory/src/modules/adjustments/dtos"
	"nantty/modules/inventory/src/utils"
)

func ValidateAdjustment(body dtos.AdjustmentRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("locationId", body.LocationId, &collected)
	if !slices.Contains(enums.AdjustmentReasons, body.Reason) {
		collected.Add("reason", "must be one of "+strings.Join(enums.AdjustmentReasons, ", "))
	}
	note := ""
	if body.Note != nil {
		note = strings.TrimSpace(*body.Note)
	}
	if len(note) > 500 {
		collected.Add("note", "must be at most 500 characters")
	}
	if (body.Reason == "theft" || body.Reason == "other") && note == "" {
		collected.Add("note", "is required for theft and other")
	}
	if len(body.Lines) < 1 || len(body.Lines) > 200 {
		collected.Add("lines", "must contain 1 to 200 lines")
	}
	seen := map[string]bool{}
	for index, line := range body.Lines {
		path := "lines." + strconv.Itoa(index)
		utils.ParseIdentifier(path+".variantId", line.VariantId, &collected)
		if seen[line.VariantId] {
			collected.Add(path+".variantId", "must be unique")
		}
		seen[line.VariantId] = true
		if line.QuantityDelta == 0 || line.QuantityDelta > 1_000_000 || line.QuantityDelta < -1_000_000 {
			collected.Add(path+".quantityDelta", "must be non-zero and at most 1000000 in size")
		}
	}
	return collected.AsError()
}
