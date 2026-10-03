package validators

import (
	"strconv"

	"zudomart/modules/orders/src/modules/returns/dtos"
	"zudomart/modules/orders/src/utils"
)

func ValidateRequestReturn(body dtos.RequestReturnRequest) error {
	var collected utils.Issues
	collected.CheckLength("reason", body.Reason, 5, 500)
	collected.CheckRange("lines", len(body.Lines), 1, 50)
	for index, line := range body.Lines {
		path := "lines." + strconv.Itoa(index)
		utils.ParseIdentifier(path+".orderItemId", line.OrderItemId, &collected)
		collected.CheckRange(path+".quantity", line.Quantity, 1, 99)
	}
	return collected.AsError()
}

func ValidateDecline(body dtos.DeclineRequest) error {
	var collected utils.Issues
	collected.CheckLength("note", body.Note, 5, 500)
	return collected.AsError()
}

func ValidateReceive(body dtos.ReceiveRequest) error {
	var collected utils.Issues
	if body.Restock && body.LocationId == nil {
		collected.Add("locationId", "is required when restocking")
	}
	if body.LocationId != nil {
		utils.ParseIdentifier("locationId", *body.LocationId, &collected)
	}
	return collected.AsError()
}
