package postdisputemessage

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/modules/disputes/dtos"
	"nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.DisputeMessageDto, bool, error) {
	application := handler.Application
	input := command.Input
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.DisputeMessageDto]{
		Scope: input.AuthorUserId + ":disputes.message", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.DisputeId, input.Text, input.AttachmentUrls, input.AsSupport, input.StoreId),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.DisputeMessageDto, error) {
			message, err := application.Disputes.AddDisputeMessageInTransaction(ctx, transaction, input)
			if err != nil {
				return dtos.DisputeMessageDto{}, err
			}
			return services.ConvertDisputeMessage(message), nil
		},
	})
}
