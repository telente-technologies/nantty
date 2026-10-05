package listsuspendedaccounts

import (
	"context"
	"strconv"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/accountsuspension"
	"zudomart/modules/users/src/generated/ent/predicate"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
)

const pageSize = 25

type Query struct {
	PendingAppealOnly bool
	Search            string
	Cursor            string
}

type Appeal struct {
	Id           string  `json:"id"`
	Status       string  `json:"status"`
	Message      string  `json:"message"`
	SubmittedAt  *string `json:"submittedAt"`
	DecisionNote string  `json:"decisionNote"`
}

type SuspendedAccount struct {
	CaseId            string                       `json:"caseId"`
	User              services.PlatformUserSummary `json:"user"`
	ReasonCode        string                       `json:"reasonCode"`
	Note              string                       `json:"note"`
	SuspendedAt       string                       `json:"suspendedAt"`
	SuspendedByName   string                       `json:"suspendedByName"`
	DeletionDueAt     string                       `json:"deletionDueAt"`
	DaysUntilDeletion int                          `json:"daysUntilDeletion"`
	Appeal            *Appeal                      `json:"appeal"`
}

type Result struct {
	Data       []SuspendedAccount `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates := []predicate.AccountSuspension{accountsuspension.StatusEQ(accountsuspension.StatusActive)}
	if query.PendingAppealOnly {
		predicates = append(predicates, accountsuspension.AppealStatusEQ(accountsuspension.AppealStatusPending))
	}
	if search := strings.TrimSpace(strings.TrimPrefix(query.Search, "@")); search != "" {
		predicates = append(predicates, accountsMatching(search))
	}
	offset, _ := strconv.Atoi(query.Cursor)
	rows, err := handler.Container.Client.AccountSuspension.Query().Where(predicates...).Order(ent.Asc(accountsuspension.FieldDeletionDueAt), ent.Asc(accountsuspension.FieldID)).Offset(offset).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []SuspendedAccount{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := strconv.Itoa(offset + pageSize)
		result.NextCursor = &next
	}
	for _, row := range rows {
		target, err := services.LoadTarget(ctx, handler.Container, row.AccountID.String())
		if err != nil {
			return result, err
		}
		summary, err := services.BuildPlatformUserSummary(ctx, handler.Container, target)
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, handler.view(row, summary))
	}
	return result, nil
}

func accountsMatching(search string) predicate.AccountSuspension {
	return func(selector *sql.Selector) {
		matching := sql.Select(profile.FieldAccountID).From(sql.Table(profile.Table)).
			Where(sql.Or(sql.ContainsFold(profile.FieldHandle, search), sql.ContainsFold(profile.FieldDisplayName, search)))
		selector.Where(sql.In(selector.C(accountsuspension.FieldAccountID), matching))
	}
}

func (handler Handler) view(row *ent.AccountSuspension, summary services.PlatformUserSummary) SuspendedAccount {
	view := SuspendedAccount{
		CaseId: row.ID.String(), User: summary, ReasonCode: row.ReasonCode, Note: row.Note, SuspendedAt: row.CreatedAt.UTC().Format(time.RFC3339), SuspendedByName: row.SuspendedByName,
		DeletionDueAt: row.DeletionDueAt.UTC().Format(time.RFC3339), DaysUntilDeletion: max(int(row.DeletionDueAt.Sub(handler.Container.Now()).Hours()/24), 0),
	}
	if row.AppealStatus != accountsuspension.AppealStatusNone {
		appeal := &Appeal{Id: row.ID.String(), Status: map[accountsuspension.AppealStatus]string{accountsuspension.AppealStatusPending: "PENDING", accountsuspension.AppealStatusUpheld: "UPHELD", accountsuspension.AppealStatusOverturned: "OVERTURNED"}[row.AppealStatus], Message: row.AppealMessage, DecisionNote: row.AppealDecisionNote}
		if row.AppealSubmittedAt != nil {
			submitted := row.AppealSubmittedAt.UTC().Format(time.RFC3339)
			appeal.SubmittedAt = &submitted
		}
		view.Appeal = appeal
	}
	return view
}
