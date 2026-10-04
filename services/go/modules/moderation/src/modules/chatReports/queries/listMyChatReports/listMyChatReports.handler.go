package listmychatreports

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/chatreport"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	listmycontentreports "zudomart/modules/moderation/src/modules/contentReports/queries/listMyContentReports"
	"zudomart/modules/moderation/src/types"
	"zudomart/platform/httpserver"
)

const pageSize = 25

type Result struct {
	Data       []types.MyReportItem `json:"data"`
	NextCursor *string              `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func statusOf(row *ent.ChatReport) (string, *string) {
	switch row.Status {
	case chatreport.StatusOpen:
		return "received", nil
	case chatreport.StatusInReview, chatreport.StatusEscalatedLegal:
		return "reviewing", nil
	case chatreport.StatusDismissed:
		note := "No violation found"
		return "no_violation", &note
	}
	note := "We took action"
	return "action_taken", &note
}

func labelOf(row *ent.ChatReport) string {
	messages, _ := services.ParseEvidence(row.Evidence)
	for _, message := range messages {
		if row.ReportedUserID != nil && message.SenderId == row.ReportedUserID.String() {
			return message.SenderName
		}
	}
	return map[chatreport.TargetType]string{"user": "User", "message": "Message", "conversation": "Conversation", "group": "Group"}[row.TargetType]
}

func (handler Handler) chatReports(ctx context.Context, reporter uuid.UUID, before *uuid.UUID) ([]types.MyReportItem, error) {
	query := handler.Container.Client.ChatReport.Query().Where(chatreport.ReporterID(reporter)).Order(ent.Desc(chatreport.FieldID)).Limit(pageSize + 1)
	if before != nil {
		query = query.Where(chatreport.IDLT(*before))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]types.MyReportItem, 0, len(rows))
	for _, row := range rows {
		status, note := statusOf(row)
		created := row.CreatedAt.UTC().Format(time.RFC3339)
		items = append(items, types.MyReportItem{Id: row.ID.String(), Kind: "chat", TargetType: string(row.TargetType), TargetLabel: labelOf(row), Reason: row.Reason, Status: status, OutcomeNote: note, CreatedAt: created, UpdatedAt: created})
	}
	return items, nil
}

func (handler Handler) Execute(ctx context.Context, reporterId, cursor string) (Result, error) {
	reporter, err := uuid.Parse(reporterId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	var before *uuid.UUID
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}})
		}
		before = &cursorId
	}
	items, err := handler.chatReports(ctx, reporter, before)
	if err != nil {
		return Result{}, err
	}
	content, err := listmycontentreports.Handler{Container: handler.Container}.Execute(ctx, listmycontentreports.Query{ReporterId: reporter, Before: before, Limit: pageSize + 1})
	if err != nil {
		return Result{}, err
	}
	items = append(items, content...)
	sort.SliceStable(items, func(left, right int) bool { return items[left].Id > items[right].Id })
	result := Result{Data: items}
	if len(items) > pageSize {
		result.Data = items[:pageSize]
		next := result.Data[pageSize-1].Id
		result.NextCursor = &next
	}
	return result, nil
}
