package closedispute

import "github.com/google/uuid"

type Command struct {
	BuyerUserId string
	DisputeId   uuid.UUID
}
