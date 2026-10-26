package revealpersonaldata

import "nantty/modules/users/src/types"

type Query struct {
	Actor    types.StaffActor
	TargetId string
	Purpose  string
}

type Result struct {
	Email            string  `json:"email"`
	Phone            string  `json:"phone"`
	LegalName        string  `json:"legalName"`
	DateOfBirth      *string `json:"dateOfBirth"`
	RevealedAt       string  `json:"revealedAt"`
	ExpiresInSeconds int     `json:"expiresInSeconds"`
}
