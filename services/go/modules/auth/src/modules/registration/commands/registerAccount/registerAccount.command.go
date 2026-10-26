package registeraccount

import (
	"nantty/modules/auth/src/types"
)

type Command struct {
	Email    string
	Birthday string
	Password string
	Username string
	Name     string
	OtpToken string
	Client   types.ClientDetails
}
