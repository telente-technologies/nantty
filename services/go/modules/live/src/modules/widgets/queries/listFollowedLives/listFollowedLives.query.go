package listfollowedlives

import "github.com/google/uuid"

type Query struct {
	ViewerId uuid.UUID
	Limit    int
}
