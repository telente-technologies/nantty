package getconsentstates

import "nantty/modules/users/src/modules/consents/models"

type Query struct {
	Subject models.Subject
}

type Result struct {
	States        []models.ConsentState
	PolicyVersion string
	NeedsRenewal  bool
}
