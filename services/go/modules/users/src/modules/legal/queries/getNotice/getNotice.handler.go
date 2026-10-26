package getnotice

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalnotice"
	"nantty/modules/users/src/modules/legal/services"
)

type Preview struct {
	Draft                        services.NoticeDraftView `json:"draft"`
	Subject                      string                   `json:"subject"`
	TotalUsers                   int                      `json:"totalUsers"`
	ExcludedHardBounces          int                      `json:"excludedHardBounces"`
	ExcludedSuppressed           int                      `json:"excludedSuppressed"`
	RecipientCount               int                      `json:"recipientCount"`
	BatchSize                    int                      `json:"batchSize"`
	RatePerSecond                int                      `json:"ratePerSecond"`
	BatchesTotal                 int                      `json:"batchesTotal"`
	EstimatedMinutes             int                      `json:"estimatedMinutes"`
	SendsWithoutMarketingConsent bool                     `json:"sendsWithoutMarketingConsent"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Draft(ctx context.Context, rawVersionId string) (services.NoticeDraftView, error) {
	var view services.NoticeDraftView
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, rawVersionId, false)
		if err != nil {
			return err
		}
		draft, err := services.EnsureNoticeDraft(ctx, tx.Client(), version)
		if err == nil {
			view = services.ConvertDraftToView(draft, version)
		}
		return err
	})
	return view, err
}

func (handler Handler) Preview(ctx context.Context, rawVersionId string) (Preview, error) {
	draft, err := handler.Draft(ctx, rawVersionId)
	if err != nil {
		return Preview{}, err
	}
	total, err := services.CountNoticeRecipients(ctx, handler.Container.Client)
	if err != nil {
		return Preview{}, err
	}
	const batchSize, rate = 50, 14
	batches := (total + batchSize - 1) / batchSize
	return Preview{Draft: draft, Subject: draft.Subject, TotalUsers: total, RecipientCount: total, BatchSize: batchSize, RatePerSecond: rate, BatchesTotal: batches,
		EstimatedMinutes: (total/rate + 59) / 60, SendsWithoutMarketingConsent: true}, nil
}

func (handler Handler) List(ctx context.Context) ([]services.NoticeProgressView, error) {
	rows, err := handler.Container.Client.LegalNotice.Query().Order(ent.Desc(legalnotice.FieldID)).Limit(50).All(ctx)
	views := make([]services.NoticeProgressView, 0, len(rows))
	for _, row := range rows {
		views = append(views, services.ConvertNoticeToView(row))
	}
	return views, err
}

func (handler Handler) Get(ctx context.Context, rawId string) (services.NoticeProgressView, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return services.NoticeProgressView{}, usersErrors.NotFound("That notice was not found.")
	}
	row, err := handler.Container.Client.LegalNotice.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.NoticeProgressView{}, usersErrors.NotFound("That notice was not found.")
	}
	if err != nil {
		return services.NoticeProgressView{}, err
	}
	return services.ConvertNoticeToView(row), nil
}
