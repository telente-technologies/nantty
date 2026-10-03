package listtermsacceptances

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/termsacceptance"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.TermsAcceptance, error) {
	return handler.Container.Client.TermsAcceptance.Query().Where(termsacceptance.AccountID(query.AccountId)).Order(ent.Desc(termsacceptance.FieldID)).All(ctx)
}
