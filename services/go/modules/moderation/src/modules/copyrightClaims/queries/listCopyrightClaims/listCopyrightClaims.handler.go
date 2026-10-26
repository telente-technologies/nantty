package listcopyrightclaims

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/copyrightclaim"
	"nantty/modules/moderation/src/generated/ent/predicate"
	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

const pageSize = 25

type Query struct {
	Status   string
	WorkType string
	Search   string
	Cursor   int
}

type Result struct {
	Data       []services.Summary `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	var predicates []predicate.CopyrightClaim
	switch status := strings.ToLower(query.Status); status {
	case "", "open":
		open := []copyrightclaim.Status{}
		for _, name := range services.OpenStatuses() {
			open = append(open, copyrightclaim.Status(name))
		}
		predicates = append(predicates, copyrightclaim.StatusIn(open...))
	case "all":
	default:
		predicates = append(predicates, copyrightclaim.StatusEQ(copyrightclaim.Status(status)))
	}
	if query.WorkType != "" {
		predicates = append(predicates, copyrightclaim.WorkTypeEQ(copyrightclaim.WorkType(strings.ToLower(query.WorkType))))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		matches := []predicate.CopyrightClaim{copyrightclaim.WorkTitleContainsFold(search), copyrightclaim.ClaimantEmailContainsFold(search), copyrightclaim.TargetIDContainsFold(search)}
		if identifier, err := uuid.Parse(search); err == nil {
			matches = append(matches, copyrightclaim.ID(identifier))
		}
		predicates = append(predicates, copyrightclaim.Or(matches...))
	}
	rows, err := handler.Container.Client.CopyrightClaim.Query().Where(predicates...).Order(ent.Asc(copyrightclaim.FieldCreatedAt), ent.Asc(copyrightclaim.FieldID)).Offset(query.Cursor).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := strconv.Itoa(query.Cursor + pageSize)
		result.NextCursor = &next
	}
	result.Data, err = services.BuildSummaries(ctx, handler.Container, rows)
	return result, err
}
