package validators

import (
	"nantty/modules/inventory/src/modules/levels/dtos"
	"nantty/modules/inventory/src/utils"
)

func ValidateReorderLevelUpdate(body dtos.ReorderLevelUpdateRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("variantId", body.VariantId, &collected)
	collected.CheckRange("reorderPoint", body.ReorderPoint, 0, 1_000_000)
	collected.CheckRange("reorderQuantity", body.ReorderQuantity, 1, 1_000_000)
	return collected.AsError()
}
