package submitcreatorapplication

import "nantty/modules/users/src/modules/creatorProgram/dtos"

type Command struct {
	AccountId      string
	IdempotencyKey string
	Input          dtos.SubmitApplicationRequest
	Lenient        bool
}
