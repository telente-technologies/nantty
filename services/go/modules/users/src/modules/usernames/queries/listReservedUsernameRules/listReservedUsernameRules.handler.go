package listreservedusernamerules

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/predicate"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/reservedusernamerule"
)

const pageSize = 50

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	rules := handler.Container.Client.ReservedUsernameRule.Query().Order(ent.Desc(reservedusernamerule.FieldID)).Limit(pageSize + 1)
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Page{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		rules = rules.Where(reservedusernamerule.IDLT(cursorId))
	}
	if search := strings.ToLower(strings.TrimSpace(query.Search)); search != "" {
		rules = rules.Where(reservedusernamerule.TermContains(search))
	}
	if kind := strings.ToLower(strings.TrimSpace(query.Kind)); kind != "" {
		if reservedusernamerule.MatchKindValidator(reservedusernamerule.MatchKind(kind)) != nil {
			return Page{}, usersErrors.ValidationFailedFor("kind", "must be exact, prefix, contains or brand")
		}
		rules = rules.Where(reservedusernamerule.MatchKindEQ(reservedusernamerule.MatchKind(kind)))
	}
	rows, err := rules.All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]Rule, 0, len(rows))}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		matching, err := handler.Container.Client.Profile.Query().Where(handleMatches(row)).Count(ctx)
		if err != nil {
			return Page{}, err
		}
		page.Data = append(page.Data, Rule{
			Id: row.ID.String(), Term: row.Term, MatchKind: string(row.MatchKind), Category: row.Category, Note: row.Note, Reason: row.Reason,
			CreatedByName: row.CreatedByName, ExistingAccountsMatching: matching, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return page, nil
}

func handleMatches(rule *ent.ReservedUsernameRule) predicate.Profile {
	switch rule.MatchKind {
	case reservedusernamerule.MatchKindExact:
		return profile.Handle(rule.Term)
	case reservedusernamerule.MatchKindPrefix:
		return profile.HandleHasPrefix(rule.Term)
	}
	return profile.HandleContains(rule.Term)
}
