package listinventorylevels

import "github.com/google/uuid"

type Query struct {
	StoreId    uuid.UUID
	LocationId uuid.UUID
	Text       string
	Stock      string
	Sort       string
	Descending bool
	Cursor     string
	Limit      int
}
