package generatebarcodes

import "github.com/google/uuid"

type Query struct {
	StoreId uuid.UUID
	Count   int
}
