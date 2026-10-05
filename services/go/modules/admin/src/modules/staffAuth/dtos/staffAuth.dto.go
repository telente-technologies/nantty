package dtos

import "encoding/json"

type LogInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ChallengeRequest struct {
	ChallengeToken string `json:"challengeToken"`
}

type ChallengeCodeRequest struct {
	ChallengeToken string          `json:"challengeToken"`
	Method         string          `json:"method"`
	Code           string          `json:"code"`
	Credential     json.RawMessage `json:"credential"`
}

type PasskeyOptionsRequest struct {
	ChallengeToken string `json:"challengeToken"`
	MfaToken       string `json:"mfaToken"`
}

func (request PasskeyOptionsRequest) Token() string {
	if request.ChallengeToken != "" {
		return request.ChallengeToken
	}
	return request.MfaToken
}

type PreferencesRequest struct {
	Theme string `json:"theme"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type StepUpRequest struct {
	Method     string          `json:"method"`
	Code       string          `json:"code"`
	Credential json.RawMessage `json:"credential"`
}

type AcceptInvitationRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}
