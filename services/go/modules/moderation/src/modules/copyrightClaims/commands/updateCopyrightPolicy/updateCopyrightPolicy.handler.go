package updatecopyrightpolicy

import (
	"context"
	"encoding/json"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/modules/copyrightClaims/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type Command struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	Settings  services.PolicySettings
	Reason    string
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.PolicySettings, error) {
	if field, valid := services.ValidatePolicySettings(command.Settings); !valid {
		return services.PolicySettings{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: field, Message: "is outside the allowed range"}})
	}
	if len(command.Reason) < 5 || len(command.Reason) > 1000 {
		return services.PolicySettings{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	before, err := services.LoadPolicySettings(ctx, handler.Container.Client)
	if err != nil {
		return services.PolicySettings{}, err
	}
	next := command.Settings
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.CopyrightPolicySetting.Query().ForUpdate().First(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if existing == nil {
			err = tx.CopyrightPolicySetting.Create().SetTakedownDeadlineHours(next.TakedownDeadlineHours).SetStrikeLifetimeDays(next.StrikeLifetimeDays).SetWarningLifetimeDays(next.WarningLifetimeDays).
				SetStrikeWindowDays(next.StrikeWindowDays).SetRestrictionThreshold(next.RestrictionThreshold).SetSuspensionReviewThreshold(next.SuspensionReviewThreshold).SetRestrictionDays(next.RestrictionDays).SetUpdatedBy(command.Staff.Id).Exec(ctx)
		} else {
			err = tx.CopyrightPolicySetting.UpdateOne(existing).SetTakedownDeadlineHours(next.TakedownDeadlineHours).SetStrikeLifetimeDays(next.StrikeLifetimeDays).SetWarningLifetimeDays(next.WarningLifetimeDays).
				SetStrikeWindowDays(next.StrikeWindowDays).SetRestrictionThreshold(next.RestrictionThreshold).SetSuspensionReviewThreshold(next.SuspensionReviewThreshold).SetRestrictionDays(next.RestrictionDays).SetUpdatedBy(command.Staff.Id).Exec(ctx)
		}
		if err != nil {
			return err
		}
		beforeJson, _ := json.Marshal(before)
		afterJson, _ := json.Marshal(next)
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "copyright.policy_updated", SubjectType: "copyright_policy", SubjectId: "default", SubjectLabel: "Copyright policy",
			Before: beforeJson, After: afterJson, Reason: command.Reason, IpAddress: command.IpAddress, RequestId: command.RequestId,
		})
	})
	if err != nil {
		return services.PolicySettings{}, err
	}
	return services.LoadPolicySettings(ctx, handler.Container.Client)
}
