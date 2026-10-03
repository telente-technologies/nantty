package dtos

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
