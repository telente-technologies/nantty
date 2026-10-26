package services

import (
	"context"
	"strings"
	"time"
	"unicode"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accounttopic"
)

const SubjectType = "topic"

type AdminTopicView struct {
	Id            string `json:"id"`
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	Status        string `json:"status"`
	IsTrending    bool   `json:"isTrending"`
	PostCount     int    `json:"postCount"`
	FollowerCount int    `json:"followerCount"`
	UpdatedAt     string `json:"updatedAt"`
}

func BuildAdminTopicView(ctx context.Context, client *ent.Client, row *ent.Topic) (AdminTopicView, error) {
	followers, err := client.AccountTopic.Query().Where(accounttopic.TopicID(row.ID)).Count(ctx)
	status := "ACTIVE"
	if !row.Active {
		status = "HIDDEN"
	}
	return AdminTopicView{
		Id: row.ID, Name: row.Name, Slug: row.ID, Status: status, IsTrending: row.IsTrending, FollowerCount: followers, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}, err
}

func SlugFromName(name string) string {
	var slug strings.Builder
	for _, character := range strings.ToLower(name) {
		switch {
		case character < unicode.MaxASCII && (unicode.IsLetter(character) || unicode.IsDigit(character)):
			slug.WriteRune(character)
		case character == ' ' || character == '&' || character == '-' || character == '_':
			if slug.Len() > 0 && !strings.HasSuffix(slug.String(), "-") {
				slug.WriteRune('-')
			}
		}
	}
	return strings.TrimSuffix(slug.String(), "-")
}
