package addaccountbirthday

import "nantty/modules/auth/src/types"

type Command struct {
	AccountId string
	Birthday  string
	Client    types.ClientDetails
}

type Result struct {
	Birthday   string `json:"birthday"`
	AgeBracket string `json:"ageBracket"`
}
