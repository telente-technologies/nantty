package httpapi

import "encoding/json"

type LogInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ChallengeRequest struct {
	ChallengeToken string `json:"challengeToken"`
}

type ChallengeCodeRequest struct {
	ChallengeToken string `json:"challengeToken"`
	Code           string `json:"code"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type StepUpRequest struct {
	Code string `json:"code"`
}

type AcceptInvitationRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type InviteStaffRequest struct {
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Permissions []string `json:"permissions"`
}

type ChangePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

type UpdateSettingRequest struct {
	Value           json.RawMessage `json:"value"`
	ExpectedVersion int             `json:"expectedVersion"`
	Reason          string          `json:"reason"`
}
