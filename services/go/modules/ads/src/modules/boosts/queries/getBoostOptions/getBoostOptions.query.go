package getboostoptions

import "github.com/google/uuid"

type Query struct {
	Currency string
	Country  string
	UserId   uuid.UUID
	Platform string
}
