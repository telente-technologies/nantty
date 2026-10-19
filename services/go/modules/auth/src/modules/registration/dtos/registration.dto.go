package dtos

type RegisterRequest struct {
	Email    string `json:"email"`
	Birthday string `json:"birthday"`
	Password string `json:"password"`
	Username string `json:"username"`
	Name     string `json:"name"`
	OtpToken string `json:"otpToken"`
}

type AddBirthdayRequest struct {
	Birthday string `json:"birthday"`
}
