package services

import (
	"context"
	"time"

	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	creatorevents "zudomart/modules/users/src/modules/creatorProgram/events"
)

func UnmetRequirementNotices(requirements []Requirement) []creatorevents.RequirementNotice {
	notices := []creatorevents.RequirementNotice{}
	for _, requirement := range requirements {
		if !requirement.Met {
			notices = append(notices, creatorevents.RequirementNotice{Label: requirement.Label, Value: requirement.CurrentValue, Target: requirement.RequiredValue})
		}
	}
	return notices
}

func EnqueueCreatorNoticeInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, application *ent.CreatorApplication, profile *ent.Profile, requirements []Requirement) error {
	account := application.AccountID.String()
	switch application.Status {
	case "approved":
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, creatorevents.CreatorApplicationApprovedType, account, now, creatorevents.ApprovedNotice{AccountId: account, Handle: profile.Handle})
	case "pending":
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, creatorevents.CreatorApplicationNeedsReviewType, account, now, creatorevents.NeedsReviewNotice{AccountId: account, ApplicationId: application.ID.String(), ReviewWithinDays: 2})
	}
	notice := creatorevents.IneligibleNotice{AccountId: account, Requirements: UnmetRequirementNotices(requirements)}
	if application.ReapplyAvailableAt != nil {
		notice.ReapplyFrom = application.ReapplyAvailableAt.UTC().Format(time.RFC3339)
	}
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, creatorevents.CreatorApplicationIneligibleType, account, now, notice)
}
