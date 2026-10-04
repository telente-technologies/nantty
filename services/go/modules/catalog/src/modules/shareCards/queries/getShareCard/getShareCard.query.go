package getsharecard

import "github.com/google/uuid"

type Query struct {
	Kind    string
	Id      uuid.UUID
	Country string
	Viewer  *uuid.UUID
}
