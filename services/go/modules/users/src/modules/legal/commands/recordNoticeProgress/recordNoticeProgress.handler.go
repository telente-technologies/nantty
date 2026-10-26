package recordnoticeprogress

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalnotice"
	"nantty/modules/users/src/modules/legal/services"
)

type Command struct {
	NoticeId            string
	Status              string
	SentCount           int
	ExcludedHardBounces int
	ExcludedSuppressed  int
	BatchesDone         int
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.NoticeProgressView, error) {
	identifier, err := uuid.Parse(command.NoticeId)
	if err != nil {
		return services.NoticeProgressView{}, usersErrors.NotFound("That notice was not found.")
	}
	if command.Status != "sending" && command.Status != "completed" {
		return services.NoticeProgressView{}, usersErrors.ValidationFailedFor("status", "must be sending or completed")
	}
	updated, err := handler.Container.Client.LegalNotice.UpdateOneID(identifier).SetStatus(legalnotice.Status(command.Status)).SetSentCount(command.SentCount).
		SetExcludedHardBounces(command.ExcludedHardBounces).SetExcludedSuppressed(command.ExcludedSuppressed).SetBatchesDone(command.BatchesDone).Save(ctx)
	if ent.IsNotFound(err) {
		return services.NoticeProgressView{}, usersErrors.NotFound("That notice was not found.")
	}
	return services.ConvertNoticeToView(updated), err
}
