package listcoinactivity

import "github.com/google/uuid"

type Query struct {
	UserId      string
	AfterLineId *uuid.UUID
	Limit       int
}
