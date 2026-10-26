package submitcreatorapplication

import "nantty/modules/users/src/modules/creatorProgram/dtos"

type Command struct {
	AccountId string
	Input     dtos.SubmitApplicationRequest
	Lenient   bool
}
