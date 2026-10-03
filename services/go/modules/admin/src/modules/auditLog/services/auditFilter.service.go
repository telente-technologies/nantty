package services

import (
	"github.com/google/uuid"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent/auditevent"
	"zudomart/modules/admin/src/generated/ent/predicate"
	"zudomart/modules/admin/src/modules/auditLog/models"
)

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
