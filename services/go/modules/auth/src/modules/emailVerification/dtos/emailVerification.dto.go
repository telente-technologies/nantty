package dtos

type ConfirmEmailVerificationRequest struct {
	Code string `json:"code"`
}

type EmailVerificationSentResponse struct {
	ExpiresIn          int `json:"expiresIn"`
	ResendAfterSeconds int `json:"resendAfterSeconds"`
}

type EmailVerifiedResponse struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
}
