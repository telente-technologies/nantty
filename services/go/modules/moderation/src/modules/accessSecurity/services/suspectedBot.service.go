package services

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/configs"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/securitycase"
	"zudomart/modules/moderation/src/generated/ent/securityevent"
)

func EvaluateAndMarkSuspectedBot(ctx context.Context, tx *ent.Tx, state *ent.SecurityAccountState, thresholds configs.AccessSecuritySettings, now time.Time) (bool, []string, error) {
	suspected, reasons := DecideSuspectedBot(BotEvidence{Score: state.BotScore, ReasonCodes: state.BotReasons, HeadlessReported: state.HeadlessReported, AttestationVerdict: state.AttestationVerdict}, thresholds)
	if state.SuspectedBot {
		return true, reasons, nil
	}
	if !suspected {
		return false, reasons, nil
	}
	accountId := state.ID
	if err := tx.SecurityAccountState.UpdateOneID(accountId).SetSuspectedBot(true).SetBotMarkedAt(now).Exec(ctx); err != nil {
		return false, nil, err
	}
	if err := RecordSecurityEvent(ctx, tx, EventInput{AccountId: &accountId, Kind: securityevent.KindBotMarked, Source: "go-trust", Detail: map[string]any{"reasons": reasons, "score": state.BotScore}}, now); err != nil {
		return false, nil, err
	}
	openCase, err := EnsureOpenCase(ctx, tx, accountId, securitycase.TriggerSuspectedBot, now)
	if err != nil {
		return false, nil, err
	}
	if err := openCase.Update().SetLastActivityAt(now).Exec(ctx); err != nil {
		return false, nil, err
	}
	return true, reasons, events.EnqueueOutboxEventInTransaction(ctx, tx, "security.botSuspected", accountId.String(), now, map[string]any{"accountId": accountId.String(), "reasons": reasons})
}
