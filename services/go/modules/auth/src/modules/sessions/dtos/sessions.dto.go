package dtos

type LogInRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type LogOutRequest struct {
	RefreshToken *string `json:"refreshToken"`
}
