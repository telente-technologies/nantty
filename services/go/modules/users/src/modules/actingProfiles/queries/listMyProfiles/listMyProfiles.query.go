package listmyprofiles

import "nantty/modules/users/src/types"

type Query struct {
	AccountId string
}

type Page struct {
	Data       []types.ActingProfileView `json:"data"`
	NextCursor *string                   `json:"nextCursor"`
}
