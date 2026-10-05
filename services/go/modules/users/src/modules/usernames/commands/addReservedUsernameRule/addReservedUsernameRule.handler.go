package addreservedusernamerule

import (
	"context"
	"regexp"
	"strings"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/reservedusernamerule"
	"zudomart/modules/users/src/services"
)

var termPattern = regexp.MustCompile(`^[a-z0-9._]{2,30}$`)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	term := strings.ToLower(strings.TrimSpace(command.Term))
	kind := reservedusernamerule.MatchKind(command.MatchKind)
	if !termPattern.MatchString(term) || reservedusernamerule.MatchKindValidator(kind) != nil {
		return Result{}, usersErrors.Unprocessable("Give a term of 2-30 lowercase letters, numbers, dots or underscores and a match kind of exact, prefix, contains or brand.")
	}
	created, err := handler.Container.Client.ReservedUsernameRule.Create().SetTerm(term).SetMatchKind(kind).SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name).
		SetCategory(command.Category).SetNote(command.Note).SetReason(command.Reason).Save(ctx)
	if ent.IsConstraintError(err) {
		return Result{}, usersErrors.UnprocessableWithCode("RULE_EXISTS", "That rule already exists.")
	}
	if err != nil {
		return Result{}, err
	}
	result := Result{Id: created.ID.String(), Term: term, MatchKind: string(kind), Category: created.Category, Note: created.Note, Reason: created.Reason, CreatedByName: created.CreatedByName}
	return result, services.RecordStaffAuditEvent(ctx, command.Actor, "users.reserved_username_added", "reservedUsernameRule", result.Id, command.Reason, nil, result)
}
