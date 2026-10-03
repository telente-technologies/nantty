package decidetopicaccess

import (
	"github.com/google/uuid"
)

type Query struct {
	UserId uuid.UUID
	Topic  string
}
