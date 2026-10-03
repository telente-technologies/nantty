package listreordersuggestions

import "github.com/google/uuid"

type Query struct {
	StoreId    uuid.UUID
	LocationId uuid.UUID
	Cursor     string
	Limit      int
}
