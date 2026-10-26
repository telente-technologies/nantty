package reportreview

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/reviews/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	ReviewId uuid.UUID
	Request  dtos.ReportRequest
}
