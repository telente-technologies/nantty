package repositories

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/modules/admin/src/types"
	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

func RecordAuditEventInTransaction(ctx context.Context, tx *ent.Tx, event identityports.AuditEvent) error {
	client := types.ClientDetailsFromContext(ctx)
	fallback := func(value, replacement string) string {
		if value == "" {
			return replacement
		}
		return value
	}
	if staff, found := staffauth.StaffFromContext(ctx); found && staff.SteppedUp && staff.Id == event.ActorId {
		event.StepUpVerified = true
	}
	staffauth.MarkAuditRecorded(ctx)
	actorName, departments := resolveActorNameAndDepartments(ctx, tx, event)
	create := tx.AuditEvent.Create().
		SetActorID(event.ActorId).SetActorRole(event.ActorRole).SetActorName(types.TruncateToLength(actorName, 120)).SetActorDepartments(departments).
		SetAction(event.Action).SetSubjectType(event.SubjectType).SetSubjectID(event.SubjectId).SetSubjectLabel(types.TruncateToLength(event.SubjectLabel, 200)).SetStepUpVerified(event.StepUpVerified).
		SetReason(types.TruncateToLength(event.Reason, 500)).
		SetIPAddress(types.TruncateToLength(fallback(event.IpAddress, client.IpAddress), 64)).
		SetUserAgent(types.TruncateToLength(fallback(event.UserAgent, client.UserAgent), 255)).
		SetRequestID(types.TruncateToLength(fallback(event.RequestId, client.RequestId), 64))
	if len(event.Before) > 0 {
		create.SetBefore(event.Before)
	}
	if len(event.After) > 0 {
		create.SetAfter(event.After)
	}
	return create.Exec(ctx)
}

func resolveActorNameAndDepartments(ctx context.Context, tx *ent.Tx, event identityports.AuditEvent) (string, []string) {
	if event.ActorName != "" && event.ActorDepartments != nil {
		return event.ActorName, event.ActorDepartments
	}
	actorId, err := uuid.Parse(event.ActorId)
	if err != nil {
		return fallbackName(event.ActorName, event.ActorId), emptyIfNil(event.ActorDepartments)
	}
	staff, err := tx.StaffAccount.Get(ctx, actorId)
	if err != nil {
		return fallbackName(event.ActorName, event.ActorId), emptyIfNil(event.ActorDepartments)
	}
	name := fallbackName(event.ActorName, strings.TrimSpace(staff.DisplayName))
	if name == "" {
		name = staff.Email
	}
	if event.ActorDepartments != nil {
		return name, event.ActorDepartments
	}
	departments := []string{}
	roleIds := make([]uuid.UUID, 0, len(staff.RoleIds))
	for _, raw := range staff.RoleIds {
		if parsed, err := uuid.Parse(raw); err == nil {
			roleIds = append(roleIds, parsed)
		}
	}
	if len(roleIds) > 0 {
		if roles, err := tx.StaffRole.Query().Where(staffrole.IDIn(roleIds...)).All(ctx); err == nil {
			for _, role := range roles {
				label := role.Department
				if label == "" {
					label = role.Name
				}
				if !slices.Contains(departments, label) {
					departments = append(departments, label)
				}
			}
		}
	}
	return name, departments
}

func fallbackName(preferred, replacement string) string {
	if preferred != "" {
		return preferred
	}
	return replacement
}

func emptyIfNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
