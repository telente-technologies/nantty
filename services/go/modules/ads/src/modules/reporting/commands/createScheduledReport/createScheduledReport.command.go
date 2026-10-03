package createscheduledreport

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/reporting/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Input     dtos.ScheduledReportInput
}
