package deletescheduledreport

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	ReportId  uuid.UUID
	UserId    uuid.UUID
}
