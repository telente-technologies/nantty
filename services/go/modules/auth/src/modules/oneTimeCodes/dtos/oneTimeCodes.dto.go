package dtos

type SendOneTimeCodeRequest struct {
	Destination string `json:"destination"`
	Purpose     string `json:"purpose"`
}

type VerifyOneTimeCodeRequest struct {
	Destination string `json:"destination"`
	Code        string `json:"code"`
	Purpose     string `json:"purpose"`
}
