package resolveadappeal

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdForReview, error) {
	deployed := handler.Container
	review, err := services.LoadReviewContext(ctx, deployed.Client, command.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	if review.Ad.AppealStatus == nil || *review.Ad.AppealStatus != ad.AppealStatusPending {
		return dtos.AdForReview{}, adserrors.NotFound
	}
	note, now := strings.TrimSpace(command.Request.Note), deployed.Now()
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		resolution := ad.AppealStatusUpheld
		if command.Request.Decision == "overturn" {
			resolution = ad.AppealStatusOverturned
			if err := services.ApproveInTransaction(ctx, tx, review, command.Reviewer, note, now); err != nil {
				return err
			}
		}
		return tx.Ad.UpdateOneID(review.Ad.ID).SetAppealStatus(resolution).SetAppealResolvedAt(now).SetAppealResolutionNote(note).Exec(ctx)
	})
	if err != nil {
		return dtos.AdForReview{}, err
	}
	review, err = services.LoadReviewContext(ctx, deployed.Client, command.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	return services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost()), nil
}
