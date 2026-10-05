package removepasskey

import "zudomart/platform/staffauth"

type Command struct {
	Actor     staffauth.Staff
	PasskeyId string
}
