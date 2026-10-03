package dtos

type ResetPasswordRequest struct {
	OtpToken string `json:"otpToken"`
	Password string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}
