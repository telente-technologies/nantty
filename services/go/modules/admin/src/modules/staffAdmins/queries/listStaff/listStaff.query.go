package liststaff

import "nantty/modules/admin/src/types"

type Query struct {
	Cursor string
	Search string
	Status string
	Role   string
}

type Result struct {
	Data       []types.StaffView `json:"data"`
	NextCursor *string           `json:"nextCursor"`
}
