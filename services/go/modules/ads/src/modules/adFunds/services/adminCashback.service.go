package services

import (
	"context"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcashbacksetting"
	"nantty/modules/ads/src/modules/adFunds/dtos"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

func presentCashback(ctx context.Context, deployed *container.Container, rows []*ent.AdCashbackSetting) []dtos.AdminCashbackSetting {
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.UserID.String())
	}
	names := usernamesFor(ctx, deployed, ids)
	presented := make([]dtos.AdminCashbackSetting, 0, len(rows))
	for _, row := range rows {
		setting := dtos.AdminCashbackSetting{UserId: row.UserID.String(), Username: names[row.UserID.String()], Enabled: row.Enabled, Percent: row.Percent, Reason: row.Reason,
			UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339)}
		if row.UpdatedByStaffID != "" {
			setting.UpdatedBy = &dtos.StaffReference{Id: row.UpdatedByStaffID, Name: row.UpdatedByName}
		}
		presented = append(presented, setting)
	}
	return presented
}

func ListCashbackSettings(ctx context.Context, deployed *container.Container, cursor *uuid.UUID, limit int) ([]dtos.AdminCashbackSetting, string, error) {
	query := deployed.Client.AdCashbackSetting.Query()
	if cursor != nil {
		query.Where(adcashbacksetting.IDLT(*cursor))
	}
	rows, err := query.Order(adcashbacksetting.ByID(sql.OrderDesc())).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	return presentCashback(ctx, deployed, rows), next, nil
}

func SetCashback(ctx context.Context, deployed *container.Container, staff StaffActor, userId uuid.UUID, request dtos.SetCashbackRequest) (*dtos.AdminCashbackSetting, dtos.AdminCashbackSetting, error) {
	reason := strings.TrimSpace(request.Reason)
	var issues []httpserver.ValidationIssue
	if request.Percent < 1 || request.Percent > 50 {
		issues = append(issues, httpserver.ValidationIssue{Path: "percent", Message: "Choose a whole percent from 1 to 50."})
	}
	if len(reason) < 5 || len(reason) > 500 {
		issues = append(issues, httpserver.ValidationIssue{Path: "reason", Message: "Give a reason of 5-500 characters."})
	}
	if len(issues) > 0 {
		return nil, dtos.AdminCashbackSetting{}, httpserver.NewValidationFailedError(issues)
	}
	var before *dtos.AdminCashbackSetting
	if existing, err := deployed.Client.AdCashbackSetting.Query().Where(adcashbacksetting.UserID(userId)).Only(ctx); err == nil {
		presented := presentCashback(ctx, deployed, []*ent.AdCashbackSetting{existing})[0]
		before = &presented
	} else if !ent.IsNotFound(err) {
		return nil, dtos.AdminCashbackSetting{}, err
	}
	err := deployed.Client.AdCashbackSetting.Create().SetUserID(userId).SetEnabled(request.Enabled).SetPercent(request.Percent).SetReason(reason).
		SetUpdatedByStaffID(staff.Id).SetUpdatedByName(staff.Name).SetUpdatedAt(deployed.Now()).
		OnConflictColumns(adcashbacksetting.FieldUserID).UpdateEnabled().UpdatePercent().UpdateReason().UpdateUpdatedByStaffID().UpdateUpdatedByName().UpdateUpdatedAt().Exec(ctx)
	if err != nil {
		return nil, dtos.AdminCashbackSetting{}, err
	}
	saved, err := deployed.Client.AdCashbackSetting.Query().Where(adcashbacksetting.UserID(userId)).Only(ctx)
	if err != nil {
		return nil, dtos.AdminCashbackSetting{}, err
	}
	return before, presentCashback(ctx, deployed, []*ent.AdCashbackSetting{saved})[0], nil
}
