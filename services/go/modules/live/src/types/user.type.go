package types

import (
	"slices"

	"github.com/google/uuid"
)

type Actor struct {
	UserId uuid.UUID
	Roles  []string
}

type UserSummary struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
	Verified  bool    `json:"verified"`
	IsCreator bool    `json:"isCreator,omitempty"`
}

func (actor Actor) HasRole(role string) bool { return slices.Contains(actor.Roles, role) }
