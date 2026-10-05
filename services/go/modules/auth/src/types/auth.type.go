package types

import "zudomart/modules/auth/src/generated/ent"

type ClientDetails struct {
	UserAgent string
	IpAddress string
	DeviceId  string
}

type IssuedTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
	TokenType    string `json:"tokenType"`
}

type AuthenticationResult struct {
	Tokens            IssuedTokens
	Account           *ent.Account
	IsNewUser         bool
	DeletionCancelled bool
	Reactivated       bool
}
