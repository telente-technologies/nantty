package getboostreport

import "github.com/google/uuid"

type Query struct {
	BoostId uuid.UUID
	UserId  uuid.UUID
}
