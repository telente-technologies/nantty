package services

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storeauditentry"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type StoreActor struct {
	AccountId uuid.UUID
	Name      string
	Role      string
	IpAddress string
}

func DescribeStoreActor(ctx context.Context, deployed *container.Container, request *http.Request, accountId uuid.UUID, role string) StoreActor {
	actor := StoreActor{AccountId: accountId, Role: role, IpAddress: ClientAddressOf(request)}
	if profiles, err := deployed.Users.PersonalProfilesByAccount(ctx, []uuid.UUID{accountId}); err == nil {
		actor.Name = profiles[accountId].Name
	}
	return actor
}

func ClientAddressOf(request *http.Request) string {
	if request == nil {
		return ""
	}
	return httpserver.ClientIP(request)
}

func RecordStoreAuditInTransaction(ctx context.Context, tx *ent.Tx, record commerceports.StoreAuditRecord) error {
	create := tx.StoreAuditEntry.Create().SetStoreID(record.StoreId).SetActorID(truncateText(record.ActorId, 80)).SetActorName(truncateText(record.ActorName, 80)).
		SetActorRole(truncateText(record.ActorRole, 20)).SetAction(truncateText(record.Action, 60)).SetTargetType(truncateText(record.TargetType, 40)).SetSummary(truncateText(record.Summary, 300))
	if record.TargetId != "" {
		create.SetTargetID(truncateText(record.TargetId, 80))
	}
	if record.IpAddress != "" {
		create.SetIPAddress(truncateText(record.IpAddress, 64))
	}
	return create.Exec(ctx)
}

func AuditRecordFor(store commerceports.StoreAccess, actor StoreActor, action, targetType, targetId, summary string) commerceports.StoreAuditRecord {
	return commerceports.StoreAuditRecord{
		StoreId: store.StoreId, ActorId: actor.AccountId.String(), ActorName: actor.Name, ActorRole: actor.Role,
		Action: action, TargetType: targetType, TargetId: targetId, Summary: summary, IpAddress: actor.IpAddress,
	}
}

type StoreAuditTrailPort struct {
	Container *container.Container
}

func (port StoreAuditTrailPort) RecordStoreAudit(ctx context.Context, record commerceports.StoreAuditRecord) error {
	return port.Container.RunInTransaction(ctx, func(tx *ent.Tx) error { return RecordStoreAuditInTransaction(ctx, tx, record) })
}

func (port StoreAuditTrailPort) RecentStoreAudit(ctx context.Context, storeId uuid.UUID, limit int) ([]commerceports.StoreAuditEntryView, error) {
	rows, err := port.Container.Client.StoreAuditEntry.Query().Where(storeauditentry.StoreID(storeId)).Order(ent.Desc(storeauditentry.FieldID)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]commerceports.StoreAuditEntryView, 0, len(rows))
	for _, row := range rows {
		views = append(views, commerceports.StoreAuditEntryView{Id: row.ID.String(), ActorName: row.ActorName, Action: row.Action, Summary: row.Summary, CreatedAt: row.CreatedAt})
	}
	return views, nil
}

func truncateText(text string, maximum int) string {
	if len(text) <= maximum {
		return text
	}
	return strings.ToValidUTF8(text[:maximum], "")
}
