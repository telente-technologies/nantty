package dtos

type CreateBattleRequest struct {
	ParticipantUserIds []string `json:"participantUserIds"`
	DurationSeconds    int      `json:"durationSeconds"`
	WinnerTakesAll     bool     `json:"winnerTakesAll"`
}
