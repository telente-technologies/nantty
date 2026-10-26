package getlegalversion

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/termsacceptance"
	"nantty/modules/users/src/modules/legal/services"
)

type Acceptance struct {
	RequiredCount int     `json:"requiredCount"`
	AcceptedCount int     `json:"acceptedCount"`
	MustAcceptBy  *string `json:"mustAcceptBy"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Version(ctx context.Context, rawId string) (services.VersionView, error) {
	var view services.VersionView
	err := handler.inTransaction(ctx, func(tx *ent.Tx) error {
		row, err := services.LoadVersionInTransaction(ctx, tx, rawId, false)
		if err == nil {
			view = services.ConvertVersionToView(row)
		}
		return err
	})
	return view, err
}

func (handler Handler) Acceptance(ctx context.Context, rawId string) (Acceptance, error) {
	var result Acceptance
	err := handler.inTransaction(ctx, func(tx *ent.Tx) error {
		row, err := services.LoadVersionInTransaction(ctx, tx, rawId, false)
		if err != nil || !row.IsMaterialChange {
			return err
		}
		if result.RequiredCount, err = services.CountNoticeRecipients(ctx, tx.Client()); err != nil {
			return err
		}
		if result.AcceptedCount, err = tx.TermsAcceptance.Query().Where(termsacceptance.PolicyVersionID(row.ID)).Count(ctx); err != nil {
			return err
		}
		deadline := row.EffectiveAt.UTC().Format(time.RFC3339)
		result.MustAcceptBy = &deadline
		return nil
	})
	return result, err
}

func (handler Handler) inTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	return handler.Container.RunInTransaction(ctx, work)
}
