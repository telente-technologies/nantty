package ingestlivesafetyscore

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/configs"
	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetysignal"
	"zudomart/modules/moderation/src/modules/liveSafety/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func validate(command Command) error {
	switch {
	case !command.AdvisoryOnly:
		return invalid("advisoryOnly", "live safety scores must be advisory")
	case command.ScoreId == "" || len(command.ScoreId) > 120:
		return invalid("scoreId", "is required")
	case command.LiveId == "" || len(command.LiveId) > 128:
		return invalid("liveId", "is required")
	case command.Kind != "frame" && command.Kind != "transcript":
		return invalid("kind", "must be frame or transcript")
	case command.Confidence < 0 || command.Confidence > 1:
		return invalid("confidence", "must be between 0 and 1")
	}
	for _, category := range command.Categories {
		if category.Confidence < 0 || category.Confidence > 1 || category.Category == "" {
			return invalid("categories", "each category needs a name and a confidence between 0 and 1")
		}
	}
	return nil
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if err := validate(command); err != nil {
		return Result{}, err
	}
	sourceKey := "score:" + command.ScoreId
	if seen, err := services.SignalAlreadyRecorded(ctx, handler.Container.Client, sourceKey); err != nil || seen {
		return Result{Duplicate: seen}, err
	}
	settings := handler.Container.Settings.LiveSafety.WithDefaults()
	hostId := services.ParseOptionalUuid(command.HostId)
	strikes := 0
	if hostId != nil {
		counts, err := strikeservices.ActiveCounts(ctx, handler.Container.Client, handler.Container.Now(), []uuid.UUID{*hostId})
		if err != nil {
			return Result{}, err
		}
		strikes = counts[*hostId].ActiveStrikes
	}
	decision := services.DecideLiveSafetyAction(settings, services.SignalAssessment{Categories: command.Categories, HashMatch: command.HashMatch, ActiveStrikes: strikes})
	existing, err := services.FindOpenIncident(ctx, handler.Container.Client, command.LiveId)
	if err != nil {
		return Result{}, err
	}
	if existing == nil && decision.Action == services.ActionNone {
		return Result{Action: decision.Action}, nil
	}
	evidenceKey := ""
	if command.HashMatch {
		evidenceKey = handler.preserveEvidence(ctx, command)
	}
	var result Result
	for attempt := 0; attempt < 2; attempt++ {
		result, err = handler.record(ctx, command, decision, hostId, sourceKey, evidenceKey, settings)
		if !ent.IsConstraintError(err) {
			break
		}
		if seen, lookupErr := services.SignalAlreadyRecorded(ctx, handler.Container.Client, sourceKey); lookupErr == nil && seen {
			return Result{Duplicate: true}, nil
		}
	}
	return result, err
}

func (handler Handler) preserveEvidence(ctx context.Context, command Command) string {
	key, err := handler.Container.EvidenceVault.PreserveFrameAsEvidence(ctx, command.FrameRef, "live-"+command.LiveId+"-"+command.ScoreId)
	if err != nil {
		handler.Container.Logger.ErrorContext(ctx, "hash-matched live frame could not be preserved; legal review must collect it manually", "liveId", command.LiveId, "error", err.Error())
		return ""
	}
	return key
}

func (handler Handler) record(ctx context.Context, command Command, decision services.Decision, hostId *uuid.UUID, sourceKey, evidenceKey string, settings configs.LiveSafetySettings) (Result, error) {
	now := handler.Container.Now()
	result := Result{Action: decision.Action}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		incident, err := services.LockOrOpenIncidentInTransaction(ctx, tx, command.LiveId, hostId, decision.Priority, now)
		if err != nil {
			return err
		}
		result.IncidentId = incident.ID.String()
		signal := tx.LiveSafetySignal.Create().SetIncidentID(incident.ID).SetLiveID(command.LiveId).SetKind(livesafetysignal.Kind(command.Kind)).SetSourceKey(sourceKey).
			SetFrameRef(command.FrameRef).SetCategories(command.categoriesJson()).SetConfidence(decision.Confidence).SetSuggestedAction(command.SuggestedAction).
			SetModelVersion(truncate(command.ModelVersion, 120)).SetActionTaken(decision.Action).SetTranscriptSnippet(truncate(command.TranscriptSnippet, 1000)).SetHashMatch(command.HashMatch).SetCreatedAt(now)
		if labels := command.labelsJson(); labels != nil {
			signal.SetLabels(labels)
		}
		if capturedAt, parseErr := time.Parse(time.RFC3339, command.CapturedAt); parseErr == nil {
			signal.SetCapturedAt(capturedAt)
		}
		if err := signal.Exec(ctx); err != nil {
			return err
		}
		if incident, err = handler.updateTopSignal(ctx, tx, incident, decision, command.HashMatch, now); err != nil {
			return err
		}
		if command.HashMatch {
			if err := recordLegalReportInTransaction(ctx, tx, incident, command, evidenceKey); err != nil {
				return err
			}
		}
		return applyDecisionInTransaction(ctx, tx, incident, decision, settings, now)
	})
	return result, err
}

func (handler Handler) updateTopSignal(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, decision services.Decision, hashMatch bool, now time.Time) (*ent.LiveSafetyIncident, error) {
	if decision.Confidence <= incident.TopConfidence && !(hashMatch && !incident.HashMatch) {
		return incident, nil
	}
	update := tx.LiveSafetyIncident.UpdateOne(incident).SetUpdatedAt(now)
	if decision.Confidence > incident.TopConfidence && decision.Action != services.ActionNone {
		update.SetTopCategory(decision.Category).SetTopConfidence(decision.Confidence)
	}
	if hashMatch {
		update.SetHashMatch(true)
	}
	return update.Save(ctx)
}

func applyDecisionInTransaction(ctx context.Context, tx *ent.Tx, incident *ent.LiveSafetyIncident, decision services.Decision, settings configs.LiveSafetySettings, now time.Time) error {
	var err error
	switch decision.Action {
	case services.ActionHold:
		incident, err = services.ApplyHoldInTransaction(ctx, tx, incident, decision.Category, "automated", decision.Confidence, now)
	case services.ActionWarn:
		incident, err = services.WarnHostInTransaction(ctx, tx, incident, decision.Category, settings.WarningCooldown, now)
	}
	if err != nil || !decision.BoostSampling {
		return err
	}
	_, err = services.BoostSamplingInTransaction(ctx, tx, incident, settings.SamplingBoost, "classifier_"+decision.Action, now)
	return err
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
