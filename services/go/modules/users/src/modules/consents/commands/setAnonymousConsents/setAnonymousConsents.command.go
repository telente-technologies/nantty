package setanonymousconsents

import "nantty/modules/users/src/modules/consents/models"

type Command struct {
	DeviceId      string
	Decisions     []models.Decision
	PolicyVersion string
	Metadata      models.RequestMetadata
}
