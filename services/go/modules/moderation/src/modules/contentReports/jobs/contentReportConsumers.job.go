package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"nantty/modules/moderation/src/container"
	ingestcontentscore "nantty/modules/moderation/src/modules/contentReports/commands/ingestContentScore"
	submitcontentreport "nantty/modules/moderation/src/modules/contentReports/commands/submitContentReport"
	"nantty/modules/moderation/src/modules/contentReports/services"
	platformevents "nantty/platform/events"
	"nantty/platform/httpserver"
)

type reportCreatedData struct {
	ReportId       string `json:"reportId"`
	ReporterId     string `json:"reporterId"`
	TargetType     string `json:"targetType"`
	TargetId       string `json:"targetId"`
	ReportedUserId string `json:"reportedUserId"`
	Reason         string `json:"reason"`
	Details        string `json:"details"`
	LiveContext    *struct {
		OffsetSeconds *float64 `json:"offsetSeconds"`
		FrameRef      string   `json:"frameRef"`
	} `json:"liveContext"`
}

func HandleReportCreatedMessage(application *container.Container, submit func(context.Context, submitcontentreport.Command) error) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: report event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != "report.created" {
			return nil
		}
		var data reportCreatedData
		if err := json.Unmarshal(envelope.Data, &data); err != nil {
			return fmt.Errorf("%w: report.created data is malformed", platformevents.ErrPoisonMessage)
		}
		if !slices.Contains(services.ContentTargetTypes, data.TargetType) {
			return nil
		}
		command := submitcontentreport.Command{ReporterId: data.ReporterId, TargetType: data.TargetType, TargetId: data.TargetId, Reason: data.Reason, Details: data.Details, AuthorId: data.ReportedUserId, SourceEventId: "event:" + envelope.Id}
		if data.LiveContext != nil {
			command.OffsetSeconds, command.FrameRef = data.LiveContext.OffsetSeconds, data.LiveContext.FrameRef
		}
		err := submit(ctx, command)
		return poisonWhenInvalid(err)
	}
}

func HandleContentScoreMessage(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var command ingestcontentscore.Command
		if err := json.Unmarshal(body, &command); err != nil {
			return fmt.Errorf("%w: content score is not JSON", platformevents.ErrPoisonMessage)
		}
		if !command.AdvisoryOnly {
			return nil
		}
		_, err := ingestcontentscore.Handler{Container: application}.Execute(ctx, command)
		return poisonWhenInvalid(err)
	}
}

func poisonWhenInvalid(err error) error {
	if apiError, isApiError := err.(*httpserver.ApiError); isApiError && apiError.Status >= 400 && apiError.Status < 500 && apiError.Status != 429 {
		return fmt.Errorf("%w: %s", platformevents.ErrPoisonMessage, apiError.Message)
	}
	return err
}
