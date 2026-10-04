package getliveincident

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetysignal"
	"zudomart/modules/moderation/src/modules/liveSafety/services"
	"zudomart/platform/httpserver"
)

const (
	latestFrameCount  = 12
	flaggedFrameCount = 24
	transcriptCount   = 10
	reportCount       = 50
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, incidentId string) (services.IncidentDetail, error) {
	identifier, err := uuid.Parse(incidentId)
	if err != nil {
		return services.IncidentDetail{}, httpserver.ErrNotFound
	}
	incident, err := handler.Container.Client.LiveSafetyIncident.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.IncidentDetail{}, httpserver.ErrNotFound
	}
	if err != nil {
		return services.IncidentDetail{}, err
	}
	signals := handler.Container.Client.LiveSafetySignal.Query().Where(livesafetysignal.IncidentID(incident.ID))
	latest, err := signals.Clone().Where(livesafetysignal.KindEQ(livesafetysignal.KindFrame)).Order(ent.Desc(livesafetysignal.FieldCreatedAt)).Limit(latestFrameCount).All(ctx)
	if err != nil {
		return services.IncidentDetail{}, err
	}
	flagged, err := signals.Clone().Where(livesafetysignal.KindEQ(livesafetysignal.KindFrame), livesafetysignal.ActionTakenNEQ("none")).Order(ent.Desc(livesafetysignal.FieldConfidence)).Limit(flaggedFrameCount).All(ctx)
	if err != nil {
		return services.IncidentDetail{}, err
	}
	transcripts, err := signals.Clone().Where(livesafetysignal.KindEQ(livesafetysignal.KindTranscript)).Order(ent.Desc(livesafetysignal.FieldCreatedAt)).Limit(transcriptCount).All(ctx)
	if err != nil {
		return services.IncidentDetail{}, err
	}
	reports, err := signals.Clone().Where(livesafetysignal.KindEQ(livesafetysignal.KindReport)).Order(ent.Desc(livesafetysignal.FieldCreatedAt)).Limit(reportCount).All(ctx)
	if err != nil {
		return services.IncidentDetail{}, err
	}
	detail := services.IncidentDetail{HoldReason: incident.HoldReason, AppealMessage: incident.AppealMessage, Decision: incident.Decision}
	detail.LatestFrames = handler.presentFrames(ctx, latest)
	detail.FlaggedFrames = handler.presentFrames(ctx, flagged)
	var latestUrl *string
	if len(detail.LatestFrames) > 0 {
		latestUrl = detail.LatestFrames[0].PreviewUrl
	}
	detail.IncidentSummary = services.PresentIncidentSummary(incident, services.HostSummaries(ctx, handler.Container, []*ent.LiveSafetyIncident{incident}), latestUrl)
	if incident.AppealedAt != nil {
		appealed := incident.AppealedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
		detail.AppealedAt = &appealed
	}
	detail.Transcripts = make([]services.TranscriptView, 0, len(transcripts))
	for _, signal := range transcripts {
		detail.Transcripts = append(detail.Transcripts, services.TranscriptView{Id: signal.ID.String(), Snippet: signal.TranscriptSnippet, Categories: signal.Categories, Confidence: signal.Confidence, CreatedAt: signal.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00")})
	}
	detail.Reports = make([]services.ReportView, 0, len(reports))
	for _, signal := range reports {
		view := services.ReportView{Id: signal.ID.String(), Reason: signal.Reason, Details: signal.Details, OffsetSeconds: signal.OffsetSeconds, FrameRef: signal.FrameRef, CreatedAt: signal.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00")}
		if signal.ReporterID != nil {
			reporter := signal.ReporterID.String()
			view.ReporterId = &reporter
		}
		detail.Reports = append(detail.Reports, view)
	}
	detail.History, err = handler.Container.Audit.History(ctx, "live_safety_incident", incident.ID.String())
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "live incident history unavailable", "error", err.Error())
	}
	if detail.History == nil {
		detail.History = []json.RawMessage{}
	}
	return detail, nil
}

func (handler Handler) presentFrames(ctx context.Context, signals []*ent.LiveSafetySignal) []services.FrameView {
	frames := make([]services.FrameView, 0, len(signals))
	for _, signal := range signals {
		frames = append(frames, services.PresentFrame(ctx, handler.Container, signal))
	}
	return frames
}
