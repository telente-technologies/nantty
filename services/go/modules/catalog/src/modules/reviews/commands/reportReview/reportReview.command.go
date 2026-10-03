package reportreview

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/reviews/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	ReviewId uuid.UUID
	Request  dtos.ReportRequest
}
