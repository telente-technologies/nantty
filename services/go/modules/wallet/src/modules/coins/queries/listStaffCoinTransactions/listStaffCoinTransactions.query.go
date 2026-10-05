package liststaffcointransactions

import "github.com/google/uuid"

type Query struct {
	Kind         string
	ReviewStatus string
	Search       string
	AfterId      *uuid.UUID
	Limit        int
}
