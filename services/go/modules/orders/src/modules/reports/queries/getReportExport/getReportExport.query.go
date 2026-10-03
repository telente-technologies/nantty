package getreportexport

import "github.com/google/uuid"

type Query struct {
	StoreId  uuid.UUID
	ExportId uuid.UUID
}
