package recordbotscore

import (
	"context"
	"math"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/securityevent"
	"nantty/modules/moderation/src/modules/accessSecurity/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil || command.ScoreId == "" || len(command.ScoreId) > 128 || math.IsNaN(command.Score) || command.Score < 0 || command.Score > 1 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "score", Message: "accountId, scoreId and a score between 0 and 1 are required"}})
	}
	codes := command.ReasonCodes
	if len(codes) > 10 {
		codes = codes[:10]
	}
	now := handler.Container.Now()
	result := Result{Reasons: []string{}}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if seen, err := services.ExternalReferenceAlreadyRecorded(ctx, tx, "botScore:"+command.ScoreId); err != nil || seen {
			return err
		}
		state, err := services.LockOrCreateAccountState(ctx, tx, accountId)
		if err != nil {
			return err
		}
		if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{
			AccountId: &accountId, Kind: securityevent.KindBotScoreRecorded, Source: "intelligence", ExternalReference: "botScore:" + command.ScoreId,
			Detail: map[string]any{"score": command.Score, "reasonCodes": codes, "modelVersion": command.ModelVersion},
		}, now); err != nil {
			return err
		}
		if err := state.Update().SetBotScore(command.Score).SetBotReasons(codes).Exec(ctx); err != nil {
			return err
		}
		state.BotScore, state.BotReasons = command.Score, codes
		result.SuspectedBot, result.Reasons, err = services.EvaluateAndMarkSuspectedBot(ctx, tx, state, services.Thresholds(handler.Container), now)
		return err
	})
	return result, err
}
