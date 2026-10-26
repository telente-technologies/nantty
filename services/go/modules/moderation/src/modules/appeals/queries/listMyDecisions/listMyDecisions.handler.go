package listmydecisions

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/appeal"
	"nantty/modules/moderation/src/generated/ent/contentreport"
	"nantty/modules/moderation/src/modules/appeals/services"
	reportservices "nantty/modules/moderation/src/modules/contentReports/services"
	"nantty/platform/httpserver"
)

const pageSize = 25

type AppealRef struct {
	Id     string `json:"id"`
	Status string `json:"status"`
}

type DecisionView struct {
	ReportId   string                    `json:"reportId"`
	Action     string                    `json:"action"`
	Reason     string                    `json:"reason"`
	DecidedAt  string                    `json:"decidedAt"`
	Target     reportservices.TargetView `json:"target"`
	Appealable bool                      `json:"appealable"`
	Appeal     *AppealRef                `json:"appeal"`
}

type Result struct {
	Data       []DecisionView `json:"data"`
	NextCursor *string        `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId, cursor string) (Result, error) {
	account, err := uuid.Parse(accountId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	offset, _ := strconv.Atoi(cursor)
	offset = max(offset, 0)
	rows, err := handler.Container.Client.ContentReport.Query().Where(contentreport.AuthorID(account), contentreport.StatusEQ(contentreport.StatusResolved)).
		Order(ent.Desc(contentreport.FieldLastReportedAt), ent.Desc(contentreport.FieldID)).Offset(offset).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []DecisionView{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := strconv.Itoa(offset + pageSize)
		result.NextCursor = &next
	}
	reportIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		reportIds = append(reportIds, row.ID)
	}
	appeals, err := handler.Container.Client.Appeal.Query().Where(appeal.ReportIDIn(reportIds...), appeal.AppellantID(account)).All(ctx)
	if err != nil {
		return Result{}, err
	}
	byReport := map[uuid.UUID]*ent.Appeal{}
	for _, row := range appeals {
		byReport[*row.ReportID] = row
	}
	for _, row := range rows {
		decision, found := services.ReportDecision(row)
		if !found {
			continue
		}
		view := DecisionView{ReportId: row.ID.String(), Action: decision.Action, Reason: decision.Reason, DecidedAt: decision.DecidedAt, Target: reportservices.BuildTarget(row)}
		if existing := byReport[row.ID]; existing != nil {
			view.Appeal = &AppealRef{Id: existing.ID.String(), Status: strings.ToUpper(string(existing.Status))}
		}
		view.Appealable = view.Appeal == nil && services.IsAppealableAction(decision.Action)
		result.Data = append(result.Data, view)
	}
	return result, nil
}
