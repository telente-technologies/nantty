package services

import (
	"slices"
	"strings"

	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/types"
)

const (
	DestinationPost    = "post"
	DestinationProfile = "profile"
	DestinationStore   = "store"
	DestinationProduct = "product"
)

var goalsByDestination = map[string][]string{
	DestinationPost:    {"views", "profile_visits", "messages"},
	DestinationProfile: {"profile_visits"},
	DestinationStore:   {"store_visits"},
	DestinationProduct: {"product_visits"},
}

var boostNounByDestination = map[string]string{DestinationPost: "post", DestinationProfile: "profile", DestinationStore: "store", DestinationProduct: "product"}

func GoalsByDestination() map[string][]string {
	copied := make(map[string][]string, len(goalsByDestination))
	for destination, goals := range goalsByDestination {
		copied[destination] = slices.Clone(goals)
	}
	return copied
}

func NormalizeBoostDestination(request dtos.BoostEstimateRequest) dtos.BoostEstimateRequest {
	request.DestinationType = strings.TrimSpace(request.DestinationType)
	if request.DestinationType == "" {
		request.DestinationType = DestinationPost
	}
	request.TargetId = strings.TrimSpace(request.TargetId)
	if request.DestinationType == DestinationPost {
		if request.TargetId == "" {
			request.TargetId = strings.TrimSpace(request.PostId)
		}
		request.PostId = request.TargetId
		return request
	}
	request.PostId = ""
	return request
}

func IsSupportedBoostDestination(destinationType string) bool {
	_, supported := goalsByDestination[destinationType]
	return supported
}

func GoalsForDestination(destinationType string) []string { return goalsByDestination[destinationType] }

func IsGoalAllowedForDestination(goal, destinationType string) bool {
	return slices.Contains(goalsByDestination[destinationType], goal)
}

func BoostNoun(destinationType string) string {
	if noun, found := boostNounByDestination[destinationType]; found {
		return noun
	}
	return "post"
}

func BoostCreativeFormat(destinationType string) string {
	switch destinationType {
	case DestinationStore:
		return "store"
	case DestinationProduct:
		return "product"
	}
	return "feed_post"
}

func BoostCreativeInput(request dtos.BoostEstimateRequest) types.CreativeInput {
	noun := BoostNoun(request.DestinationType)
	targetId := request.TargetId
	destination := types.CreativeDestination{Type: request.DestinationType, TargetId: &targetId}
	if request.Goal == "messages" {
		destination = types.CreativeDestination{Type: "messages"}
	}
	return types.CreativeInput{
		Format: BoostCreativeFormat(request.DestinationType), Source: types.CreativeSource{Type: request.DestinationType, Id: targetId}, MediaIds: []string{},
		Headline: "Boosted " + noun, CallToAction: CallToActionForGoal(request.Goal), Destination: destination,
	}
}
