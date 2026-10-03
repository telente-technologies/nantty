package liststaff

import "zudomart/modules/admin/src/types"

type Query struct {
	Cursor string
}

type Result struct {
	Data       []types.StaffView `json:"data"`
	NextCursor *string           `json:"nextCursor"`
}
