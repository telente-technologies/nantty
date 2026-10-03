package services

import (
	"slices"

	"github.com/google/uuid"
)

type LevelCapacity struct {
	LevelId    uuid.UUID
	LocationId uuid.UUID
	OnHand     int
	Reserved   int
}

func (capacity LevelCapacity) Available() int { return capacity.OnHand - capacity.Reserved }

type Allocation struct {
	LevelId    uuid.UUID
	LocationId uuid.UUID
	Quantity   int
}

func TotalAvailable(levels []LevelCapacity) int {
	total := 0
	for _, level := range levels {
		total += max(level.Available(), 0)
	}
	return total
}

func AllocateAcrossLocations(levels []LevelCapacity, quantity int) ([]Allocation, bool) {
	if quantity <= 0 {
		return nil, false
	}
	ranked := slices.Clone(levels)
	slices.SortFunc(ranked, func(left, right LevelCapacity) int {
		if left.Available() != right.Available() {
			return right.Available() - left.Available()
		}
		return slices.Compare(left.LevelId[:], right.LevelId[:])
	})
	remaining := quantity
	allocations := make([]Allocation, 0, len(ranked))
	for _, level := range ranked {
		if remaining == 0 {
			break
		}
		take := min(max(level.Available(), 0), remaining)
		if take == 0 {
			continue
		}
		allocations = append(allocations, Allocation{LevelId: level.LevelId, LocationId: level.LocationId, Quantity: take})
		remaining -= take
	}
	return allocations, remaining == 0
}
