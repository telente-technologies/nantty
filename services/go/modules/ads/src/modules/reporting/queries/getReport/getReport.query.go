package getreport

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/reporting/dtos"
)

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Report    dtos.ReportQuery
}
