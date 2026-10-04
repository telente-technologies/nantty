package listdisputes

import "github.com/google/uuid"

type Query struct {
	ViewerUserId string
	AsStaff      bool
	StoreId      string
	Status       string
	AfterId      *uuid.UUID
	Limit        int
}
