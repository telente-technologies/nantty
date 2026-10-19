package dtos

type GoogleSignInRequest struct {
	IdToken  string `json:"idToken"`
	Nonce    string `json:"nonce"`
	Birthday string `json:"birthday"`
}

type AppleFullNameRequest struct {
	GivenName  *string `json:"givenName"`
	FamilyName *string `json:"familyName"`
}

type AppleSignInRequest struct {
	IdentityToken string                `json:"identityToken"`
	Nonce         string                `json:"nonce"`
	FullName      *AppleFullNameRequest `json:"fullName"`
	Birthday      string                `json:"birthday"`
}
