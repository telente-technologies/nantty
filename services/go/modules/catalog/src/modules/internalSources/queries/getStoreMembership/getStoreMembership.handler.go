package getstoremembership

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storemember"
)

type Query struct {
	StoreId   uuid.UUID
	AccountId uuid.UUID
}

type Result struct {
	IsMember bool    `json:"isMember"`
	Role     *string `json:"role"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	store, err := handler.Container.Client.Store.Get(ctx, query.StoreId)
	if ent.IsNotFound(err) {
		return Result{}, nil
	}
	if err != nil {
		return Result{}, err
	}
	if store.OwnerAccountID == query.AccountId {
		role := "owner"
		return Result{IsMember: true, Role: &role}, nil
	}
	member, err := handler.Container.Client.StoreMember.Query().
		Where(storemember.StoreID(query.StoreId), storemember.AccountID(query.AccountId), storemember.Status("active")).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, nil
	}
	if err != nil {
		return Result{}, err
	}
	return Result{IsMember: true, Role: &member.Role}, nil
}
