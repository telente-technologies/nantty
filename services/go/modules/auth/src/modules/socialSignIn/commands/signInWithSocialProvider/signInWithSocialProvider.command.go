package signinwithsocialprovider

import (
	identity "zudomart/modules/auth/src/integrations"
	"zudomart/modules/auth/src/types"
)

type Command struct {
	Provider identity.Provider
	Token    string
	Nonce    string
	FullName string
	Birthday string
	Client   types.ClientDetails
}
