package loginwithpassword

import (
	"nantty/modules/auth/src/types"
)

type Command struct {
	Identifier string
	Password   string
	Client     types.ClientDetails
}
