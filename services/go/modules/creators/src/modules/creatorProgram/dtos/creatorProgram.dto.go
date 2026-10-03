package dtos

type CreatorTierDto struct {
	Id           string `json:"id"`
	Name         string `json:"name"`
	GiftShareBps int64  `json:"giftShareBps"`
	IsDefault    bool   `json:"isDefault"`
}

type CreatorMembershipDto struct {
	UserId string `json:"userId"`
	TierId string `json:"tierId"`
	Status string `json:"status"`
}

type SetCreatorMembershipRequestDto struct {
	TierId string `json:"tierId"`
	Status string `json:"status"`
}

type UpdateCreatorTierRequestDto struct {
	GiftShareBps int64 `json:"giftShareBps"`
}
