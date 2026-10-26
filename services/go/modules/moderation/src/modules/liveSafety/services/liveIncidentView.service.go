package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/integrations"
)

type IncidentSummary struct {
	Id             string                   `json:"id"`
	LiveId         string                   `json:"liveId"`
	Host           integrations.UserSummary `json:"host"`
	Status         string                   `json:"status"`
	Priority       string                   `json:"priority"`
	HoldActive     bool                     `json:"holdActive"`
	HoldCategory   string                   `json:"holdCategory"`
	HoldSource     string                   `json:"holdSource"`
	HoldStartedAt  *string                  `json:"holdStartedAt"`
	TopCategory    string                   `json:"topCategory"`
	TopConfidence  float64                  `json:"topConfidence"`
	ReportCount    int                      `json:"reportCount"`
	WarningCount   int                      `json:"warningCount"`
	HashMatch      bool                     `json:"hashMatch"`
	Appealed       bool                     `json:"appealed"`
	LiveEnded      bool                     `json:"liveEnded"`
	Resolution     string                   `json:"resolution"`
	SlaDueAt       string                   `json:"slaDueAt"`
	CreatedAt      string                   `json:"createdAt"`
	UpdatedAt      string                   `json:"updatedAt"`
	LatestFrameUrl *string                  `json:"latestFrameUrl"`
}

type FrameView struct {
	Id           string          `json:"id"`
	FrameRef     string          `json:"frameRef"`
	PreviewUrl   *string         `json:"previewUrl"`
	Restricted   bool            `json:"restricted"`
	CapturedAt   *string         `json:"capturedAt"`
	Labels       json.RawMessage `json:"labels"`
	Categories   json.RawMessage `json:"categories"`
	Confidence   float64         `json:"confidence"`
	ActionTaken  string          `json:"actionTaken"`
	ModelVersion string          `json:"modelVersion"`
}

type TranscriptView struct {
	Id         string          `json:"id"`
	Snippet    string          `json:"snippet"`
	Categories json.RawMessage `json:"categories"`
	Confidence float64         `json:"confidence"`
	CreatedAt  string          `json:"createdAt"`
}

type ReportView struct {
	Id            string   `json:"id"`
	Reason        string   `json:"reason"`
	Details       string   `json:"details"`
	OffsetSeconds *float64 `json:"offsetSeconds"`
	FrameRef      string   `json:"frameRef"`
	ReporterId    *string  `json:"reporterId"`
	CreatedAt     string   `json:"createdAt"`
}

type IncidentDetail struct {
	IncidentSummary
	HoldReason    string            `json:"holdReason"`
	AppealedAt    *string           `json:"appealedAt"`
	AppealMessage string            `json:"appealMessage"`
	LatestFrames  []FrameView       `json:"latestFrames"`
	FlaggedFrames []FrameView       `json:"flaggedFrames"`
	Transcripts   []TranscriptView  `json:"transcripts"`
	Reports       []ReportView      `json:"reports"`
	Decision      json.RawMessage   `json:"decision"`
	History       []json.RawMessage `json:"history"`
}

func optionalStamp(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := stamp(*moment)
	return &formatted
}

func HostSummaries(ctx context.Context, application *container.Container, incidents []*ent.LiveSafetyIncident) map[string]integrations.UserSummary {
	var hostIds []uuid.UUID
	for _, incident := range incidents {
		if incident.HostID != nil {
			hostIds = append(hostIds, *incident.HostID)
		}
	}
	if len(hostIds) == 0 {
		return map[string]integrations.UserSummary{}
	}
	summaries, err := application.Users.Summaries(ctx, hostIds)
	if err != nil {
		application.Logger.WarnContext(ctx, "live incident hosts could not be resolved", "error", err.Error())
		return map[string]integrations.UserSummary{}
	}
	return summaries
}

func PresentIncidentSummary(incident *ent.LiveSafetyIncident, hosts map[string]integrations.UserSummary, latestFrameUrl *string) IncidentSummary {
	host := hosts[HostIdString(incident)]
	if host == nil {
		host = integrations.UserSummary{"id": HostIdString(incident)}
	}
	if incident.HashMatch {
		latestFrameUrl = nil
	}
	return IncidentSummary{
		Id: incident.ID.String(), LiveId: incident.LiveID, Host: host, Status: string(incident.Status), Priority: string(incident.Priority),
		HoldActive: incident.HoldActive, HoldCategory: incident.HoldCategory, HoldSource: incident.HoldSource, HoldStartedAt: optionalStamp(incident.HoldStartedAt),
		TopCategory: incident.TopCategory, TopConfidence: incident.TopConfidence, ReportCount: incident.ReportCount, WarningCount: incident.WarningCount,
		HashMatch: incident.HashMatch, Appealed: incident.AppealedAt != nil, LiveEnded: incident.LiveEndedAt != nil, Resolution: incident.Resolution,
		SlaDueAt: stamp(incident.SLADueAt), CreatedAt: stamp(incident.CreatedAt), UpdatedAt: stamp(incident.UpdatedAt), LatestFrameUrl: latestFrameUrl,
	}
}

func PresentFrame(ctx context.Context, application *container.Container, signal *ent.LiveSafetySignal) FrameView {
	view := FrameView{
		Id: signal.ID.String(), FrameRef: signal.FrameRef, Restricted: signal.HashMatch, CapturedAt: optionalStamp(signal.CapturedAt), Labels: emptyArrayWhenNil(signal.Labels),
		Categories: emptyArrayWhenNil(signal.Categories), Confidence: signal.Confidence, ActionTaken: signal.ActionTaken, ModelVersion: signal.ModelVersion,
	}
	if signal.HashMatch {
		view.FrameRef, view.Labels = "", json.RawMessage("[]")
		return view
	}
	view.PreviewUrl = PresignFrame(ctx, application, signal.FrameRef)
	return view
}

func PresignFrame(ctx context.Context, application *container.Container, frameRef string) *string {
	if frameRef == "" || application.FramePreviews == nil {
		return nil
	}
	url, err := application.FramePreviews.PresignFramePreview(ctx, frameRef, application.Settings.LiveSafety.WithDefaults().FramePreviewLifetime)
	if err != nil || url == "" {
		return nil
	}
	return &url
}

func emptyArrayWhenNil(raw []byte) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("[]")
	}
	return raw
}
