package dtos

import "time"

type CreatorTierDto struct {
	Id           string `json:"id"`
	Name         string `json:"name"`
	GiftShareBps int64  `json:"giftShareBps"`
	IsDefault    bool   `json:"isDefault"`
}

type CreatorMembershipDto struct {
	UserId           string     `json:"userId"`
	TierId           string     `json:"tierId"`
	Status           string     `json:"status"`
	SuspensionReason string     `json:"suspensionReason"`
	SuspendedAt      *time.Time `json:"suspendedAt"`
}

type SetCreatorMembershipRequestDto struct {
	TierId string `json:"tierId"`
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type CreatorViolationDto struct {
	Id         string    `json:"id"`
	UserId     string    `json:"userId"`
	Reason     string    `json:"reason"`
	Source     string    `json:"source"`
	RecordedBy string    `json:"recordedBy"`
	CreatedAt  time.Time `json:"createdAt"`
}

type RecordViolationRequestDto struct {
	Reason string `json:"reason"`
}

type UpdateCreatorTierRequestDto struct {
	GiftShareBps int64 `json:"giftShareBps"`
}
