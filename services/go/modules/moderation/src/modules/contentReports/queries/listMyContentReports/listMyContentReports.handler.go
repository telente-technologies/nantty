package listmycontentreports

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/contentreport"
	"nantty/modules/moderation/src/generated/ent/contentreportentry"
	"nantty/modules/moderation/src/types"
)

type Handler struct {
	Container *container.Container
}

func statusOf(row *ent.ContentReport) (string, *string) {
	switch row.Status {
	case contentreport.StatusOpen:
		return "received", nil
	case contentreport.StatusInReview:
		return "reviewing", nil
	case contentreport.StatusDismissed:
		note := "No violation found"
		return "no_violation", &note
	}
	note := "We took action"
	return "action_taken", &note
}

func labelOf(row *ent.ContentReport) string {
	var preview struct {
		Title *string `json:"title"`
		Text  *string `json:"text"`
	}
	if len(row.TargetPreview) > 0 && json.Unmarshal(row.TargetPreview, &preview) == nil {
		for _, candidate := range []*string{preview.Title, preview.Text} {
			if candidate != nil && strings.TrimSpace(*candidate) != "" {
				label := strings.TrimSpace(*candidate)
				if len(label) > 60 {
					label = label[:60]
				}
				return label
			}
		}
	}
	targetType := string(row.TargetType)
	return strings.ToUpper(targetType[:1]) + targetType[1:]
}

func (handler Handler) Execute(ctx context.Context, request Query) ([]types.MyReportItem, error) {
	query := handler.Container.Client.ContentReportEntry.Query().Where(contentreportentry.ReporterID(request.ReporterId)).Order(ent.Desc(contentreportentry.FieldID)).Limit(request.Limit)
	if request.Before != nil {
		query.Where(contentreportentry.IDLT(*request.Before))
	}
	entries, err := query.All(ctx)
	if err != nil || len(entries) == 0 {
		return []types.MyReportItem{}, err
	}
	reportIds := make([]uuid.UUID, 0, len(entries))
	for _, entry := range entries {
		reportIds = append(reportIds, entry.ReportID)
	}
	reports, err := handler.Container.Client.ContentReport.Query().Where(contentreport.IDIn(reportIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	reportsById := map[uuid.UUID]*ent.ContentReport{}
	for _, report := range reports {
		reportsById[report.ID] = report
	}
	items := make([]types.MyReportItem, 0, len(entries))
	for _, entry := range entries {
		report, found := reportsById[entry.ReportID]
		if !found {
			continue
		}
		status, note := statusOf(report)
		targetId := report.TargetID
		items = append(items, types.MyReportItem{
			Id: entry.ID.String(), Kind: "content", TargetType: string(report.TargetType), TargetId: &targetId, TargetLabel: labelOf(report), Reason: entry.Reason, Status: status, OutcomeNote: note,
			CreatedAt: entry.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: report.LastReportedAt.UTC().Format(time.RFC3339),
		})
	}
	return items, nil
}
