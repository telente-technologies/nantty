package getdispute

import "github.com/google/uuid"

type Query struct {
	DisputeId    uuid.UUID
	ViewerUserId string
	AsStaff      bool
	StoreId      string
}
