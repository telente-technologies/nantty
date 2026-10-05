package listadminrefunds

import "github.com/google/uuid"

type Query struct {
	Source  string
	Status  string
	OrderId *uuid.UUID
	Text    string
	Cursor  string
	Limit   int
}
