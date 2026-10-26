package markcointransactionreviewed

import (
	"context"

	"nantty/modules/wallet/src/modules/coins"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Application.Reviews.MarkReviewed(ctx, command.StaffId, command.TransactionId, command.Note)
}
