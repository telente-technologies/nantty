package signinwithsocialprovider

import (
	identity "nantty/modules/auth/src/integrations"
	"nantty/modules/auth/src/types"
)

type Command struct {
	Provider identity.Provider
	Token    string
	Nonce    string
	FullName string
	Birthday string
	Client   types.ClientDetails
}
