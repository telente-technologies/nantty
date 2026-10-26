package services

import (
	"context"
	"database/sql"
	"time"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/creatorprogrammember"
	"nantty/modules/creators/src/generated/ent/creatorviolation"
	"nantty/modules/creators/src/modules/creatorProgram/dtos"
	"nantty/modules/ledger/src/databases"
)

type MembershipChange struct {
	StaffId string
	UserId  string
	TierId  string
	Status  string
	Reason  string
}

func ConvertMembership(member *ent.CreatorProgramMember) dtos.CreatorMembershipDto {
	return dtos.CreatorMembershipDto{UserId: member.UserID, TierId: member.TierID, Status: member.Status.String(), SuspensionReason: member.SuspensionReason, SuspendedAt: member.SuspendedAt}
}

func (program CreatorProgram) FindMembership(ctx context.Context, userId string) (*ent.CreatorProgramMember, error) {
	member, err := program.Container.Client(program.Container.Resources.Database).CreatorProgramMember.Query().Where(creatorprogrammember.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return member, err
}

func (program CreatorProgram) SetCreatorProgramMembership(ctx context.Context, change MembershipChange) (dtos.CreatorMembershipDto, error) {
	var saved *ent.CreatorProgramMember
	err := databases.RunInMoneyTransaction(ctx, program.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := program.Container.Client(transaction)
		if _, err := client.CreatorTier.Get(ctx, change.TierId); ent.IsNotFound(err) {
			return ErrCreatorTierNotFound
		} else if err != nil {
			return err
		}
		previous, err := client.CreatorProgramMember.Query().Where(creatorprogrammember.UserID(change.UserId)).ForUpdate().Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		now := program.Container.Now().UTC()
		suspending := change.Status == "suspended" && (previous == nil || previous.Status != creatorprogrammember.StatusSuspended)
		reason, suspendedAt := "", (*time.Time)(nil)
		if change.Status == "suspended" {
			reason, suspendedAt = change.Reason, &now
			if previous != nil && !suspending {
				reason, suspendedAt = firstNonEmpty(change.Reason, previous.SuspensionReason), previous.SuspendedAt
			}
		}
		err = client.CreatorProgramMember.Create().SetUserID(change.UserId).SetTierID(change.TierId).SetStatus(creatorprogrammember.Status(change.Status)).
			SetSuspensionReason(reason).SetNillableSuspendedAt(suspendedAt).SetUpdatedByStaffID(change.StaffId).SetCreatedAt(now).
			OnConflictColumns(creatorprogrammember.FieldUserID).UpdateTierID().UpdateStatus().UpdateSuspensionReason().UpdateSuspendedAt().UpdateUpdatedByStaffID().UpdateUpdatedAt().Exec(ctx)
		if err != nil {
			return err
		}
		if suspending {
			if err := client.CreatorViolation.Create().SetUserID(change.UserId).SetReason(firstNonEmpty(change.Reason, "Suspended by an administrator")).
				SetRecordedByStaffID(change.StaffId).SetCreatedAt(now).Exec(ctx); err != nil {
				return err
			}
		}
		if saved, err = client.CreatorProgramMember.Query().Where(creatorprogrammember.UserID(change.UserId)).Only(ctx); err != nil {
			return err
		}
		if previous != nil && previous.Status == saved.Status {
			return nil
		}
		return program.Container.Outbox.EnqueueInTransaction(ctx, transaction, "creator.standingChanged", change.UserId, now, map[string]any{
			"userId": change.UserId, "status": change.Status, "reason": reason, "actorId": change.StaffId,
		})
	})
	if err != nil {
		return dtos.CreatorMembershipDto{}, err
	}
	return ConvertMembership(saved), nil
}

func (program CreatorProgram) RecordViolation(ctx context.Context, staffId, userId, reason, source string) (dtos.CreatorViolationDto, error) {
	violation, err := program.Container.Client(program.Container.Resources.Database).CreatorViolation.Create().SetUserID(userId).SetReason(reason).
		SetSource(firstNonEmpty(source, "staff")).SetRecordedByStaffID(staffId).SetCreatedAt(program.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return dtos.CreatorViolationDto{}, err
	}
	return convertViolation(violation), nil
}

func (program CreatorProgram) ListViolations(ctx context.Context, userId string) ([]dtos.CreatorViolationDto, error) {
	rows, err := program.Container.Client(program.Container.Resources.Database).CreatorViolation.Query().Where(creatorviolation.UserID(userId)).
		Order(ent.Desc(creatorviolation.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]dtos.CreatorViolationDto, 0, len(rows))
	for _, row := range rows {
		views = append(views, convertViolation(row))
	}
	return views, nil
}

func (program CreatorProgram) CountRecentViolations(ctx context.Context, userId string, lookbackDays int) (int, error) {
	since := program.Container.Now().UTC().AddDate(0, 0, -max(lookbackDays, 1))
	return program.Container.Client(program.Container.Resources.Database).CreatorViolation.Query().
		Where(creatorviolation.UserID(userId), creatorviolation.CreatedAtGTE(since)).Count(ctx)
}

func convertViolation(row *ent.CreatorViolation) dtos.CreatorViolationDto {
	return dtos.CreatorViolationDto{Id: row.ID.String(), UserId: row.UserID, Reason: row.Reason, Source: row.Source, RecordedBy: row.RecordedByStaffID, CreatedAt: row.CreatedAt}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
