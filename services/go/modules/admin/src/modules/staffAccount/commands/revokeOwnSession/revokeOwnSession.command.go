package revokeownsession

import "nantty/platform/staffauth"

type Command struct {
	Actor           staffauth.Staff
	TargetSessionId string
}
