package services

import (
	"fmt"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/modules/adReview/dtos"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

var reviewStatusLabels = map[ad.ReviewStatus]string{ad.ReviewStatusPending: "PENDING", ad.ReviewStatusApproved: "APPROVED", ad.ReviewStatusRejected: "REJECTED", ad.ReviewStatusNotSubmitted: "PENDING"}

func PresentAdvertiserRef(account *ent.AdAccount) dtos.AdvertiserRef {
	status := "ACTIVE"
	if account.Status == "disabled" {
		status = "SUSPENDED"
	}
	return dtos.AdvertiserRef{Id: account.ID.String(), Name: account.Name, Status: status}
}

func PresentAdForReview(row *ent.Ad, account *ent.AdAccount, campaign *ent.AdCampaign, group *ent.AdGroup, isBoost bool) dtos.AdForReview {
	creative := row.Creative.Resolved
	imageUrl, kind := "", "IMAGE"
	if len(creative.Media) > 0 {
		imageUrl = creative.Media[0].Url
		if creative.Media[0].Kind == "video" {
			kind = "VIDEO"
		}
	}
	presented := dtos.AdForReview{
		Id: row.ID.String(), CampaignName: campaign.Name, Advertiser: PresentAdvertiserRef(account), IsBoostedPost: isBoost,
		Creative:  dtos.ReviewCreative{Format: kind, ImageUrl: imageUrl, Headline: creative.Headline, PrimaryText: creative.PrimaryText, CallToAction: creative.CallToAction, LandingUrl: landingUrl(creative.Destination), Type: creative.Type, Cards: reviewCards(creative), App: creative.App},
		Targeting: presentTargeting(group), DailyBudget: dailyBudgetOf(campaign, group, account.Currency), TotalBudget: totalBudgetOf(campaign, group, account.Currency),
		Schedule: dtos.ReviewSchedule{StartsAt: group.StartAt.UTC().Format(time.RFC3339)}, AutoCheckFlags: row.AutoCheckFlags, Status: reviewStatusLabels[row.ReviewStatus],
		AdCategory: adsservices.EffectiveAdCategory(row, campaign), AgeRestricted: adsservices.IsAgeRestrictedAd(row, campaign),
	}
	if presented.AutoCheckFlags == nil {
		presented.AutoCheckFlags = []types.AutoCheckFlag{}
	}
	if group.EndAt != nil {
		end := group.EndAt.UTC().Format(time.RFC3339)
		presented.Schedule.EndsAt = &end
	}
	if row.SubmittedAt != nil {
		presented.SubmittedAt = row.SubmittedAt.UTC().Format(time.RFC3339)
	}
	if row.ReviewedAt != nil {
		code := row.PolicyCode
		decision := &dtos.ReviewDecision{Reason: row.PolicyReason, DecidedByName: row.ReviewedByName, DecidedAt: row.ReviewedAt.UTC().Format(time.RFC3339)}
		if code != "" {
			decision.PolicyCategoryId = &code
		}
		presented.Decision = decision
	}
	if row.AppealStatus != nil && row.AppealSubmittedAt != nil {
		presented.Appeal = &dtos.AppealForReview{Status: string(*row.AppealStatus), Message: row.AppealMessage, SubmittedAt: row.AppealSubmittedAt.UTC().Format(time.RFC3339)}
	}
	return presented
}

func landingUrl(destination types.CreativeDestination) string {
	if destination.Url != nil {
		if tagged, err := adsservices.ApplyUtm(*destination.Url, destination.Utm); err == nil {
			return tagged
		}
		return *destination.Url
	}
	if destination.TargetId != nil {
		return fmt.Sprintf("nantty://%s/%s", destination.Type, *destination.TargetId)
	}
	return ""
}

func reviewCards(creative types.Creative) []dtos.ReviewCard {
	cards := make([]dtos.ReviewCard, 0, len(creative.Cards))
	for _, card := range creative.Cards {
		cards = append(cards, dtos.ReviewCard{ImageUrl: card.Media.Url, Headline: card.Headline, Description: card.Description, CallToAction: card.CallToAction, LandingUrl: landingUrl(card.Destination)})
	}
	return cards
}

func presentTargeting(group *ent.AdGroup) dtos.ReviewTargeting {
	countries := []string{}
	for _, location := range group.Audience.Locations {
		countries = append(countries, location.CountryCode)
	}
	placements := group.Placements
	if len(placements) == 0 {
		placements = []string{"automatic"}
	}
	interests := group.Audience.TopicIds
	if interests == nil {
		interests = []string{}
	}
	return dtos.ReviewTargeting{Countries: countries, AgeRange: fmt.Sprintf("%d-%d", group.Audience.AgeMin, group.Audience.AgeMax), Interests: interests, Placements: placements}
}

func dailyBudgetOf(campaign *ent.AdCampaign, group *ent.AdGroup, currency string) types.Money {
	if group.BudgetType != nil && *group.BudgetType == "daily" && group.BudgetAmountMinor != nil {
		return types.Money{AmountMinor: *group.BudgetAmountMinor, Currency: currency}
	}
	if campaign.BudgetType != nil && *campaign.BudgetType == "daily" && campaign.BudgetAmountMinor != nil {
		return types.Money{AmountMinor: *campaign.BudgetAmountMinor, Currency: currency}
	}
	return types.Money{Currency: currency}
}

func totalBudgetOf(campaign *ent.AdCampaign, group *ent.AdGroup, currency string) *types.Money {
	if group.BudgetType != nil && *group.BudgetType == "lifetime" && group.BudgetAmountMinor != nil {
		return &types.Money{AmountMinor: *group.BudgetAmountMinor, Currency: currency}
	}
	if campaign.BudgetType != nil && *campaign.BudgetType == "lifetime" && campaign.BudgetAmountMinor != nil {
		return &types.Money{AmountMinor: *campaign.BudgetAmountMinor, Currency: currency}
	}
	return nil
}
