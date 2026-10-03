package listipclaims

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/ipclaim"
	"zudomart/modules/moderation/src/generated/ent/predicate"
	"zudomart/modules/moderation/src/modules/ipClaims/services"
)

const pageSize = 25

type Query struct {
	Status string
	Kind   string
	Search string
	Cursor int
}

type Result struct {
	Data       []services.Summary `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	var predicates []predicate.IpClaim
	switch status := strings.ToLower(query.Status); status {
	case "", "open":
		predicates = append(predicates, ipclaim.StatusIn(ipclaim.StatusOpen, ipclaim.StatusNeedsInfo))
	case "all":
	default:
		predicates = append(predicates, ipclaim.StatusEQ(ipclaim.Status(status)))
	}
	if query.Kind != "" {
		predicates = append(predicates, ipclaim.KindEQ(ipclaim.Kind(strings.ToLower(query.Kind))))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		matches := []predicate.IpClaim{ipclaim.ListingIDContainsFold(search), ipclaim.ClaimantBrandIDContainsFold(search)}
		if identifier, err := uuid.Parse(search); err == nil {
			matches = append(matches, ipclaim.ID(identifier), ipclaim.AccusedSellerID(identifier))
		}
		predicates = append(predicates, ipclaim.Or(matches...))
	}
	rows, err := handler.Container.Client.IpClaim.Query().Where(predicates...).Order(ent.Asc(ipclaim.FieldSLADueAt), ent.Asc(ipclaim.FieldID)).Offset(query.Cursor).Limit(pageSize + 1).All(ctx)
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
