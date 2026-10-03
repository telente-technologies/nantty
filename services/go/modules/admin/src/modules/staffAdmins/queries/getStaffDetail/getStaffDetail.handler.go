package getstaffdetail

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/auditevent"
	"zudomart/modules/admin/src/generated/ent/predicate"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	"zudomart/modules/admin/src/modules/auditLog/models"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	target, err := uuid.Parse(query.TargetId)
	if err != nil {
		return Result{}, adminerrors.StaffNotFound
	}
	row, err := handler.Container.Client.StaffAccount.Get(ctx, target)
	if ent.IsNotFound(err) {
		return Result{}, adminerrors.StaffNotFound
	}
	if err != nil {
		return Result{}, err
	}
	view, err := services.BuildSingleStaffView(ctx, handler.Container, row)
	if err != nil {
		return Result{}, err
	}
	sessions, err := handler.Container.Client.StaffSession.Query().Where(staffsession.StaffID(target), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(handler.Container.Now())).Count(ctx)
	if err != nil {
		return Result{}, err
	}
	history, err := handler.auditViews(ctx, auditevent.SubjectType("staff"), auditevent.SubjectID(target.String()), 50)
	if err != nil {
		return Result{}, err
	}
	last, err := handler.auditViews(ctx, auditevent.ActorID(target.String()), nil, 15)
	return Result{Admin: view, ActiveSessionCount: sessions, History: history, LastActions: last}, err
}

func (handler Handler) auditViews(ctx context.Context, first predicate.AuditEvent, second predicate.AuditEvent, limit int) ([]models.AuditEventView, error) {
	request := handler.Container.Client.AuditEvent.Query().Where(first)
	if second != nil {
		request = request.Where(second)
	}
	rows, err := request.Order(ent.Desc(auditevent.FieldID)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]models.AuditEventView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertAuditEventToView(row))
	}
	return views, nil
}
