package updatenoticedraft

import "nantty/modules/users/src/types"

type Command struct {
	Actor        types.StaffActor
	VersionId    string
	Subject      string
	SummaryText  string
	WhatChanged  []string
	ReacceptNote string
}
