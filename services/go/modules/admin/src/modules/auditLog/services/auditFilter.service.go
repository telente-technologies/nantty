package services

import (
	"strings"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent/auditevent"
	"nantty/modules/admin/src/generated/ent/predicate"
	"nantty/modules/admin/src/modules/auditLog/models"
)

var searchableAuditColumns = []string{auditevent.FieldAction, auditevent.FieldActorName, auditevent.FieldSubjectLabel, auditevent.FieldSubjectID, auditevent.FieldReason}

func PredicatesForAuditFilter(filter models.AuditFilter) ([]predicate.AuditEvent, error) {
	var predicates []predicate.AuditEvent
	if filter.Action != "" {
		predicates = append(predicates, auditevent.Action(filter.Action))
	}
	if filter.ActorId != "" {
		predicates = append(predicates, auditevent.ActorID(filter.ActorId))
	}
	if filter.SubjectType != "" {
		predicates = append(predicates, auditevent.SubjectType(filter.SubjectType))
	}
	if filter.SubjectId != "" {
		predicates = append(predicates, auditevent.SubjectID(filter.SubjectId))
	}
	if filter.Area != "" {
		predicates = append(predicates, auditevent.ActionHasPrefix(strings.ToLower(filter.Area)))
	}
	if filter.RequestId != "" {
		predicates = append(predicates, auditevent.RequestID(filter.RequestId))
	}
	if filter.StepUpOnly {
		predicates = append(predicates, auditevent.StepUpVerified(true))
	}
	if filter.Search != "" {
		predicates = append(predicates, searchPredicate(filter.Search))
	}
	if filter.From != nil {
		predicates = append(predicates, auditevent.CreatedAtGTE(*filter.From))
	}
	if filter.To != nil {
		predicates = append(predicates, auditevent.CreatedAtLT(*filter.To))
	}
	if filter.Cursor != "" {
		cursorId, err := uuid.Parse(filter.Cursor)
		if err != nil {
			return nil, adminerrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, auditevent.IDLT(cursorId))
	}
	return predicates, nil
}

func searchPredicate(search string) predicate.AuditEvent {
	pattern := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.ToLower(search)) + "%"
	return predicate.AuditEvent(func(selector *sql.Selector) {
		matches := make([]*sql.Predicate, 0, len(searchableAuditColumns))
		for _, column := range searchableAuditColumns {
			matches = append(matches, sql.P(func(builder *sql.Builder) {
				builder.WriteString("lower(" + selector.C(column) + ") LIKE ").Arg(pattern)
			}))
		}
		selector.Where(sql.Or(matches...))
	})
}
