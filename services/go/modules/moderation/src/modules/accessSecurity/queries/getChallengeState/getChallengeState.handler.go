package getchallengestate

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/securityaccountstate"
	"zudomart/modules/moderation/src/modules/accessSecurity/services"
	"zudomart/platform/httpserver"
)

type Result struct {
	Requirement  string  `json:"requirement"`
	Reason       string  `json:"reason,omitempty"`
	SuspectedBot bool    `json:"suspectedBot"`
	ClearedUntil *string `json:"clearedUntil"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawAccountId string) (Result, error) {
	accountId, err := uuid.Parse(rawAccountId)
	if err != nil {
		return Result{}, httpserver.ErrNotFound
	}
	state, err := handler.Container.Client.SecurityAccountState.Query().Where(securityaccountstate.ID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{Requirement: services.RequirementNone}, nil
	}
	if err != nil {
		return Result{}, err
	}
	suspended := services.IsAutoSuspensionActive(state, services.Thresholds(handler.Container), handler.Container.Now())
	result := Result{SuspectedBot: state.SuspectedBot}
	result.Requirement, result.Reason = services.ChallengeRequirement(suspended, state.SuspectedBot, state.ChallengeRequired)
	if state.ClearedUntil != nil {
		formatted := state.ClearedUntil.UTC().Format(time.RFC3339)
		result.ClearedUntil = &formatted
	}
	return result, nil
}
