package validators

import (
	"strconv"
	"strings"

	"nantty/modules/inventory/src/modules/transfers/dtos"
	"nantty/modules/inventory/src/utils"
)

func ValidateTransfer(body dtos.TransferRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("fromLocationId", body.FromLocationId, &collected)
	utils.ParseIdentifier("toLocationId", body.ToLocationId, &collected)
	if body.FromLocationId == body.ToLocationId {
		collected.Add("toLocationId", "must differ from fromLocationId")
	}
	if body.Note != nil && len(strings.TrimSpace(*body.Note)) > 500 {
		collected.Add("note", "must be at most 500 characters")
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
		collected.CheckRange(path+".quantity", line.Quantity, 1, 1_000_000)
	}
	return collected.AsError()
}
