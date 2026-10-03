package getdataexport

import "github.com/google/uuid"

type Query struct {
	AccountId uuid.UUID
	ExportId  uuid.UUID
}
