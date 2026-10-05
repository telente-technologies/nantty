package liststaffdisputes

import "github.com/google/uuid"

type Query struct {
	Statuses []string
	Search   string
	AfterId  *uuid.UUID
	Limit    int
}
