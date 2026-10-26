package models

import "nantty/modules/admin/src/types"

type LoginChallengeResult struct {
	Status           string `json:"status"`
	ChallengeToken   string `json:"challengeToken"`
	ExpiresIn        int    `json:"expiresIn"`
	PasskeyAvailable bool   `json:"passkeyAvailable"`
}

type StaffSessionResult struct {
	AccessToken   string          `json:"accessToken"`
	RefreshToken  string          `json:"refreshToken"`
	ExpiresIn     int             `json:"expiresIn"`
	TokenType     string          `json:"tokenType"`
	Staff         types.StaffView `json:"staff"`
	RecoveryCodes []string        `json:"recoveryCodes,omitempty"`
}

type StepUpResult struct {
	StepUpToken string `json:"stepUpToken"`
	ExpiresIn   int    `json:"expiresIn"`
}

type TotpEnrollment struct {
	Secret     string `json:"secret"`
	OtpauthUri string `json:"otpauthUri"`
}
