package setrecordinglegalhold

import "github.com/google/uuid"

type Command struct {
	LiveId uuid.UUID
	Held   bool
}
