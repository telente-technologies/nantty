package listcities

import "github.com/google/uuid"

type Query struct {
	RegionId  *uuid.UUID
	AdminArea *uuid.UUID
}
