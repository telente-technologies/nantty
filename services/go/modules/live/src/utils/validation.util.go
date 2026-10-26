package utils

import (
	"slices"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type Issues []httpserver.ValidationIssue

func (collected *Issues) Add(path, message string) {
	*collected = append(*collected, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collected Issues) AsError() error {
	if len(collected) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collected)
}

var (
	LiveCategories   = []string{"justChatting", "gaming", "music", "irl", "education", "shopping"}
	GiftTiers        = []string{"basic", "premium", "legendary"}
	AnimationEngines = []string{"alphaVideo", "lottie", "pag", "spriteSheet"}
	DisplayLevels    = []string{"micro", "medium", "large", "global"}
	Haptics          = []string{"light", "medium", "heavy", "pattern"}
	RankingBoards    = []string{"streamer", "supporter", "creator", "engagement"}
	RankingScopes    = []string{"global", "country", "category"}
	RankingPeriods   = []string{"day", "week", "month", "all"}
	CommentAudiences = []string{"everyone", "followers", "subscribers"}
)

func IsCommentAudience(value string) bool {
	return slices.Contains(CommentAudiences, value)
}

func ParseIdentifiers(path string, values []string, collected *Issues) []uuid.UUID {
	parsed := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		identifier, err := uuid.Parse(value)
		if err != nil {
			collected.Add(path, "must contain valid ids")
			continue
		}
		parsed = append(parsed, identifier)
	}
	return parsed
}
