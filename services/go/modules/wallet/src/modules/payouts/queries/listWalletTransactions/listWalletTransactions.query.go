package listwallettransactions

import "github.com/google/uuid"

type Query struct {
	UserId      string
	Currency    string
	AfterLineId *uuid.UUID
	Limit       int
}
