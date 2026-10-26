package recordconversion

import (
	"time"

	"nantty/platform/httpserver"
)

const attributionWindow = 28 * 24 * time.Hour

type Command struct {
	ConversionId string    `json:"conversionId"`
	UserId       string    `json:"userId"`
	StoreId      string    `json:"storeId"`
	ValueMinor   int64     `json:"valueMinor"`
	Currency     string    `json:"currency"`
	OccurredAt   time.Time `json:"occurredAt"`
}

func (command Command) Validate() error {
	if command.ConversionId == "" || command.UserId == "" || command.StoreId == "" || command.ValueMinor < 0 || len(command.Currency) != 3 || command.OccurredAt.IsZero() {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "body", Message: "conversionId, userId, storeId, valueMinor, currency and occurredAt are required"}})
	}
	return nil
}
