package getmoderationtargetpreview

import "github.com/google/uuid"

type Query struct {
	LiveId  uuid.UUID
	SpaceId uuid.UUID
}
