package removepasskey

import "nantty/platform/staffauth"

type Command struct {
	Actor     staffauth.Staff
	PasskeyId string
}
