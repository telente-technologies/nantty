package services

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

func SubmitBlackAppeal(ctx context.Context, c *container.Container, accountId, applicationId, reason, supportingDetails string) (BlackAppealView, error) {
	accId, err := uuid.Parse(accountId)
	if err != nil {
		return BlackAppealView{}, usersErrors.ErrAccountUnavailable
	}
	appId, err := uuid.Parse(applicationId)
	if err != nil {
		return BlackAppealView{}, usersErrors.NotFound("That application was not found.")
	}
	reason = strings.TrimSpace(reason)
	if len(reason) < 10 || len(reason) > 2000 {
		return BlackAppealView{}, usersErrors.ValidationFailedFor("reason", "appeal reason must be between 10 and 2000 characters")
	}
	row, err := c.Client.BlackApplication.Query().Where(blackapplication.ID(appId), blackapplication.AccountID(accId)).Only(ctx)
	if ent.IsNotFound(err) {
		return BlackAppealView{}, usersErrors.NotFound("That application was not found.")
	}
	if err != nil {
		return BlackAppealView{}, err
	}
	if row.Status != blackapplication.StatusRejected && row.Status != blackapplication.StatusRevoked && row.Status != blackapplication.StatusReverificationRequired {
		return BlackAppealView{}, usersErrors.Conflict("APPEAL_NOT_ALLOWED", "Appeals are available only when verification is rejected, revoked, or requires reverification.")
	}
	now := c.Now().UTC()
	appeal := BlackAppealView{
		Id: uuid.Must(uuid.NewV7()).String(), ApplicationId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(),
		Reason: reason, SupportingDetails: strings.TrimSpace(supportingDetails), Status: "open", CreatedAt: now,
	}
	if c.Database != nil {
		_, err = c.Database.ExecContext(ctx, `
			INSERT INTO black_verification_appeals (id, application_id, profile_id, account_id, reason, supporting_details, status, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)`,
			appeal.Id, row.ID, row.ProfileID, row.AccountID, appeal.Reason, appeal.SupportingDetails, now)
		if err != nil {
			return BlackAppealView{}, err
		}
	}
	return appeal, nil
}

func ListBlackAppeals(ctx context.Context, db *sql.DB, applicationId string) ([]BlackAppealView, error) {
	if db == nil {
		return []BlackAppealView{}, nil
	}
	query := `SELECT id::text, application_id::text, profile_id::text, account_id::text, reason, supporting_details, status,
	                 reviewed_by_staff_id, reviewed_by_name, decision_note, reviewed_at, created_at
	          FROM black_verification_appeals`
	var rows *sql.Rows
	var err error
	if applicationId != "" {
		rows, err = db.QueryContext(ctx, query+` WHERE application_id::text = $1 ORDER BY created_at DESC LIMIT 50`, applicationId)
	} else {
		rows, err = db.QueryContext(ctx, query+` ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	appeals := []BlackAppealView{}
	for rows.Next() {
		var a BlackAppealView
		var reviewedAt sql.NullTime
		if err := rows.Scan(&a.Id, &a.ApplicationId, &a.ProfileId, &a.AccountId, &a.Reason, &a.SupportingDetails, &a.Status,
			&a.ReviewedByStaffId, &a.ReviewedByName, &a.DecisionNote, &reviewedAt, &a.CreatedAt); err != nil {
			return nil, err
		}
		if reviewedAt.Valid {
			t := reviewedAt.Time
			a.ReviewedAt = &t
		}
		appeals = append(appeals, a)
	}
	return appeals, rows.Err()
}

func DecideBlackAppeal(ctx context.Context, c *container.Container, actor types.StaffActor, appealId, decision, note string) (BlackAppealView, error) {
	if decision != "upheld" && decision != "overturned" {
		return BlackAppealView{}, usersErrors.ValidationFailedFor("decision", "must be upheld or overturned")
	}
	note = strings.TrimSpace(note)
	if len(note) < 5 {
		return BlackAppealView{}, usersErrors.ValidationFailedFor("note", "decision note must be at least 5 characters")
	}
	if c.Database == nil {
		return BlackAppealView{}, usersErrors.NotFound("Appeal store unavailable.")
	}
	now := c.Now().UTC()
	var appId uuid.UUID
	var currentStatus string
	err := c.Database.QueryRowContext(ctx, `SELECT application_id, status FROM black_verification_appeals WHERE id::text = $1`, appealId).Scan(&appId, &currentStatus)
	if err == sql.ErrNoRows {
		return BlackAppealView{}, usersErrors.NotFound("Appeal not found.")
	}
	if err != nil {
		return BlackAppealView{}, err
	}
	if currentStatus != "open" && currentStatus != "under_review" {
		return BlackAppealView{}, usersErrors.Conflict("APPEAL_ALREADY_DECIDED", "This appeal has already been decided.")
	}
	if _, err := c.Database.ExecContext(ctx, `
		UPDATE black_verification_appeals
		SET status = $2, reviewed_by_staff_id = $3, reviewed_by_name = $4, decision_note = $5, reviewed_at = $6
		WHERE id::text = $1`, appealId, decision, actor.Id, actor.Name, note, now); err != nil {
		return BlackAppealView{}, err
	}
	if decision == "overturned" {
		// Reopen to in_review so two-admin approval & payment gates remain mandatory.
		_ = c.Client.BlackApplication.UpdateOneID(appId).SetStatus(blackapplication.StatusInReview).
			SetFirstApprovalBy("").SetFirstApprovalByName("").ClearFirstApprovalAt().
			SetSecondApprovalBy("").SetSecondApprovalByName("").ClearSecondApprovalAt().
			SetDecisionReason("Appeal overturned: " + note).Exec(ctx)
	}
	_ = usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
		Action: "black_appeal." + decision, SubjectType: "black_appeal", SubjectId: appealId, SubjectLabel: appId.String(), Reason: note,
		Before: map[string]any{"status": currentStatus}, After: map[string]any{"status": decision},
	})
	appeals, err := ListBlackAppeals(ctx, c.Database, appId.String())
	if err != nil {
		return BlackAppealView{}, err
	}
	for _, item := range appeals {
		if item.Id == appealId {
			return item, nil
		}
	}
	return BlackAppealView{Id: appealId, ApplicationId: appId.String(), Status: decision, ReviewedByStaffId: actor.Id, ReviewedByName: actor.Name, DecisionNote: note, ReviewedAt: &now}, nil
}
