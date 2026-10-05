package services

import (
	"context"
	"fmt"
	"time"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/dataexportrequest"
	exportevents "zudomart/modules/users/src/modules/dataExport/events"
)

const staleProcessingAfter = 15 * time.Minute

func ClaimNextExportRequest(ctx context.Context, c *container.Container) (*ent.DataExportRequest, error) {
	var claimed *ent.DataExportRequest
	err := c.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := c.Now()
		next, err := tx.DataExportRequest.Query().
			Where(dataexportrequest.Or(
				dataexportrequest.StatusEQ(dataexportrequest.StatusRequested),
				dataexportrequest.And(dataexportrequest.StatusEQ(dataexportrequest.StatusProcessing), dataexportrequest.ClaimedAtLT(now.Add(-staleProcessingAfter))),
			)).
			Order(ent.Asc(dataexportrequest.FieldID)).Limit(1).ForUpdate(skipLocked()).First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		claimed, err = next.Update().SetStatus(dataexportrequest.StatusProcessing).SetClaimedAt(now).Save(ctx)
		return err
	})
	return claimed, err
}

func BuildAndStoreArchive(ctx context.Context, c *container.Container, store ObjectStore, request *ent.DataExportRequest) (key string, size int64, err error) {
	contents, err := CollectUserOwnedExportData(ctx, c.Client, request.AccountID, c.Now(), c.Settings.AddressPhoneKey)
	if err != nil {
		return "", 0, err
	}
	archive, err := BuildZipArchive(contents)
	if err != nil {
		return "", 0, err
	}
	key = fmt.Sprintf("exports/%s/%s.zip", request.AccountID, request.ID)
	return key, int64(len(archive)), store.Put(ctx, key, archive, "application/zip")
}

func MarkExportReady(ctx context.Context, c *container.Container, request *ent.DataExportRequest, key string, size int64) error {
	return c.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := c.Now()
		expiresAt := now.Add(c.Settings.Privacy.ExportArchiveTtl)
		if err := tx.DataExportRequest.UpdateOneID(request.ID).SetStatus(dataexportrequest.StatusReady).SetObjectKey(key).SetSizeBytes(size).SetCompletedAt(now).SetExpiresAt(expiresAt).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, exportevents.DataExportCompletedType, request.AccountID.String(), now, exportevents.DataExportCompletedData{
			AccountId: request.AccountID.String(), ExportId: request.ID.String(), CompletedAt: now.UTC().Format(time.RFC3339), ExpiresAt: expiresAt.UTC().Format(time.RFC3339), SizeBytes: size,
		})
	})
}

func MarkExportFailed(ctx context.Context, c *container.Container, request *ent.DataExportRequest, reason string) error {
	if len(reason) > 190 {
		reason = reason[:190]
	}
	return c.Client.DataExportRequest.UpdateOneID(request.ID).SetStatus(dataexportrequest.StatusFailed).SetFailureReason(reason).Exec(ctx)
}

func ReleaseExportClaim(ctx context.Context, c *container.Container, request *ent.DataExportRequest) error {
	return c.Client.DataExportRequest.UpdateOneID(request.ID).SetStatus(dataexportrequest.StatusRequested).ClearClaimedAt().Exec(ctx)
}

func ExpireReadyExports(ctx context.Context, c *container.Container, storeProvider func(context.Context) (ObjectStore, error)) (int, error) {
	due, err := c.Client.DataExportRequest.Query().Where(dataexportrequest.StatusEQ(dataexportrequest.StatusReady), dataexportrequest.ExpiresAtLTE(c.Now())).Limit(50).All(ctx)
	if err != nil || len(due) == 0 {
		return 0, err
	}
	store, err := storeProvider(ctx)
	if err != nil {
		return 0, err
	}
	expired := 0
	for _, request := range due {
		if request.ObjectKey != nil {
			if err := store.Delete(ctx, *request.ObjectKey); err != nil {
				c.Logger.WarnContext(ctx, "could not delete expired export archive", "exportId", request.ID.String(), "error", err.Error())
				continue
			}
		}
		if err := request.Update().SetStatus(dataexportrequest.StatusExpired).ClearObjectKey().Exec(ctx); err != nil {
			return expired, err
		}
		expired++
	}
	return expired, nil
}
