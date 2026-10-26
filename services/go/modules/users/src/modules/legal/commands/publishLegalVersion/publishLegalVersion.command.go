package publishlegalversion

import "nantty/modules/users/src/types"

type Command struct {
	Actor                  types.StaffActor
	VersionId              string
	Reason                 string
	AcknowledgeShortNotice bool
}

type Result struct {
	Version  any     `json:"version"`
	NoticeId *string `json:"noticeId"`
}
