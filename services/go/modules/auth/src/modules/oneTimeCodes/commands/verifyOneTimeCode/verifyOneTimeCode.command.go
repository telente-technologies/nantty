package verifyonetimecode

type Command struct {
	Destination string
	Code        string
	Purpose     string
}

type Result struct {
	OtpToken string `json:"otpToken"`
}
