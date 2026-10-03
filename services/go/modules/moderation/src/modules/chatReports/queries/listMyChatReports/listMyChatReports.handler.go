package listmychatreports

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/chatreport"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	"zudomart/platform/httpserver"
)

const pageSize = 25

type Item struct {
	Id          string  `json:"id"`
	TargetType  string  `json:"targetType"`
	TargetLabel string  `json:"targetLabel"`
	Reason      string  `json:"reason"`
	Status      string  `json:"status"`
	OutcomeNote *string `json:"outcomeNote"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

type Result struct {
	Data       []Item  `json:"data"`
	NextCursor *string `json:"nextCursor"`
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

func (handler Handler) Execute(ctx context.Context, reporterId, cursor string) (Result, error) {
	reporter, err := uuid.Parse(reporterId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	query := handler.Container.Client.ChatReport.Query().Where(chatreport.ReporterID(reporter)).Order(ent.Desc(chatreport.FieldID)).Limit(pageSize + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is invalid"}})
		}
		query = query.Where(chatreport.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []Item{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		status, note := statusOf(row)
		result.Data = append(result.Data, Item{Id: row.ID.String(), TargetType: string(row.TargetType), TargetLabel: labelOf(row), Reason: row.Reason, Status: status, OutcomeNote: note, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return result, nil
}
