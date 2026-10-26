package createstocktransfer

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocktransferline"
)

func transferLineOf(transferId uuid.UUID) predicate.StockTransferLine {
	return stocktransferline.TransferID(transferId)
}

func linePairs(command Command) []struct {
	VariantId uuid.UUID
	Quantity  int
} {
	pairs := make([]struct {
		VariantId uuid.UUID
		Quantity  int
	}, 0, len(command.Request.Lines))
	for _, line := range command.Request.Lines {
		pairs = append(pairs, struct {
			VariantId uuid.UUID
			Quantity  int
		}{uuid.MustParse(line.VariantId), line.Quantity})
	}
	return pairs
}
