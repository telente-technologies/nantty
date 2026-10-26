package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/generated/ent/privacysetting"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/platform/identityports"
)

type Segment struct {
	Id                    string `json:"id"`
	Label                 string `json:"label"`
	Description           string `json:"description"`
	RecipientCount        int    `json:"recipientCount"`
	MarketingConsentCount int    `json:"marketingConsentCount"`
}

var segmentDefinitions = []Segment{
	{Id: "all-users", Label: "Everyone", Description: "Every active account"},
	{Id: "creators", Label: "Creators", Description: "Accounts in the Creator Program"},
	{Id: "verified", Label: "Verified profiles", Description: "Profiles with a checkmark"},
	{Id: "business-owners", Label: "Business owners", Description: "Accounts with a business or brand profile"},
}

func segmentPredicates(ctx context.Context, application *container.Container, segmentId string) ([]predicate.Profile, bool, error) {
	base := []predicate.Profile{profile.KindEQ(profile.KindPersonal), profile.StatusEQ(profile.StatusActive)}
	switch segmentId {
	case "all-users":
		return base, true, nil
	case "creators":
		return append(base, profile.CreatorStatusEQ(profile.CreatorStatusApproved)), true, nil
	case "verified":
		return append(base, profile.Verified(true)), true, nil
	case "business-owners":
		owners, err := application.Client.Profile.Query().Where(profile.KindEQ(profile.KindBusiness), profile.StatusEQ(profile.StatusActive)).Unique(true).Select(profile.FieldAccountID).Strings(ctx)
		identifiers := make([]uuid.UUID, 0, len(owners))
		for _, raw := range owners {
			if identifier, parseErr := uuid.Parse(raw); parseErr == nil {
				identifiers = append(identifiers, identifier)
			}
		}
		return append(base, profile.AccountIDIn(identifiers...)), true, err
	}
	return nil, false, nil
}

func CountSegment(ctx context.Context, application *container.Container, segmentId string) (total, marketing int, found bool, err error) {
	predicates, found, err := segmentPredicates(ctx, application, segmentId)
	if err != nil || !found {
		return 0, 0, false, err
	}
	total, err = application.Client.Profile.Query().Where(predicates...).Count(ctx)
	if err != nil {
		return 0, 0, true, err
	}
	accountIds, err := application.Client.PrivacySetting.Query().Where(privacysetting.Marketing(true)).Select(privacysetting.FieldAccountID).Strings(ctx)
	if err != nil {
		return 0, 0, true, err
	}
	parsed := make([]uuid.UUID, 0, len(accountIds))
	for _, raw := range accountIds {
		if identifier, parseErr := uuid.Parse(raw); parseErr == nil {
			parsed = append(parsed, identifier)
		}
	}
	if len(parsed) == 0 {
		return total, 0, true, nil
	}
	marketing, err = application.Client.Profile.Query().Where(append(predicates, profile.AccountIDIn(parsed...))...).Count(ctx)
	return total, marketing, true, err
}

func ListSegments(ctx context.Context, application *container.Container) ([]Segment, error) {
	segments := make([]Segment, 0, len(segmentDefinitions))
	for _, definition := range segmentDefinitions {
		total, marketing, _, err := CountSegment(ctx, application, definition.Id)
		if err != nil {
			return nil, err
		}
		definition.RecipientCount, definition.MarketingConsentCount = total, marketing
		segments = append(segments, definition)
	}
	return segments, nil
}

func ListAudiencePage(ctx context.Context, application *container.Container, segmentId, cursor string, limit int) ([]Recipient, *string, bool, error) {
	predicates, found, err := segmentPredicates(ctx, application, segmentId)
	if err != nil || !found {
		return nil, nil, false, err
	}
	if cursor != "" {
		if identifier, err := uuid.Parse(cursor); err == nil {
			predicates = append(predicates, profile.IDGT(identifier))
		}
	}
	rows, err := application.Client.Profile.Query().Where(predicates...).Order(ent.Asc(profile.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, nil, true, err
	}
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1].ID.String()
		next = &last
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return nil, nil, true, err
	}
	recipients := make([]Recipient, 0, len(rows))
	for _, row := range rows {
		summary, exists, err := directory.FindAccountSummary(ctx, row.AccountID)
		if err != nil {
			return nil, nil, true, err
		}
		if !exists || summary.Status == "banned" || summary.Status == "deleted" || summary.Email == nil || strings.TrimSpace(*summary.Email) == "" {
			continue
		}
		recipient, err := BuildRecipient(ctx, application, summary)
		if err != nil {
			return nil, nil, true, err
		}
		recipients = append(recipients, recipient)
	}
	return recipients, next, true, nil
}
