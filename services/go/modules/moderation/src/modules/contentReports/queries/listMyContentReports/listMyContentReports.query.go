package listmycontentreports

import "github.com/google/uuid"

type Query struct {
	ReporterId uuid.UUID
	Before     *uuid.UUID
	Limit      int
}
