package listadsforreview

import "github.com/google/uuid"

type Query struct {
	Status       string
	AdvertiserId *uuid.UUID
	Search       string
	Page         int
	PageSize     int
}
