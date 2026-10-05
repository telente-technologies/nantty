package revokeownsession

import "zudomart/platform/staffauth"

type Command struct {
	Actor           staffauth.Staff
	TargetSessionId string
}
