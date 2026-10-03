package listdisputes

import "github.com/google/uuid"

type Query struct {
	ViewerUserId string
	AsStaff      bool
	Status       string
	AfterId      *uuid.UUID
	Limit        int
}
