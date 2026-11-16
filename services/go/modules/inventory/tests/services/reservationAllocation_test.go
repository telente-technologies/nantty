package services_test

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/services"
)

func TestAllocateAcrossLocationsPrefersMostAvailableStockFirst(t *testing.T) {
	small, large := capacityAt(3, 0), capacityAt(10, 2)
	allocations, enough := services.AllocateAcrossLocations([]services.LevelCapacity{small, large}, 9)
	if !enough || len(allocations) != 2 {
		t.Fatalf("expected two allocations covering the request, got %+v enough=%v", allocations, enough)
	}
	if allocations[0].LevelId != large.LevelId || allocations[0].Quantity != 8 {
		t.Fatalf("expected the larger location to be drained first, got %+v", allocations)
	}
	if allocations[1].LevelId != small.LevelId || allocations[1].Quantity != 1 {
		t.Fatalf("expected the remainder from the smaller location, got %+v", allocations)
	}
}

func TestAllocateAcrossLocationsRejectsWhenStockIsShort(t *testing.T) {
	cases := []struct {
		name     string
		levels   []services.LevelCapacity
		quantity int
		enough   bool
	}{
		{"exact fit", []services.LevelCapacity{capacityAt(5, 0)}, 5, true},
		{"one short", []services.LevelCapacity{capacityAt(5, 1)}, 5, false},
		{"reserved stock is not sellable", []services.LevelCapacity{capacityAt(5, 5)}, 1, false},
		{"over reserved levels count as zero", []services.LevelCapacity{capacityAt(2, 4), capacityAt(3, 0)}, 3, true},
		{"nothing requested", []services.LevelCapacity{capacityAt(5, 0)}, 0, false},
		{"no levels", nil, 1, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, enough := services.AllocateAcrossLocations(testCase.levels, testCase.quantity); enough != testCase.enough {
				t.Fatalf("enough = %v, want %v", enough, testCase.enough)
			}
		})
	}
}

func TestConcurrentReservationsNeverOversell(t *testing.T) {
	stock := &lockedStockLevels{levels: []services.LevelCapacity{capacityAt(30, 0), capacityAt(20, 0)}}
	var succeeded atomic.Int64
	var group sync.WaitGroup
	for attempt := 0; attempt < 400; attempt++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if stock.reserve(1) {
				succeeded.Add(1)
			}
		}()
	}
	group.Wait()
	totalReserved := 0
	for _, level := range stock.levels {
		if level.Reserved > level.OnHand {
			t.Fatalf("level %s reserved %d above on hand %d", level.LevelId, level.Reserved, level.OnHand)
		}
		totalReserved += level.Reserved
	}
	if succeeded.Load() != 50 || totalReserved != 50 {
		t.Fatalf("succeeded=%d reserved=%d, want exactly 50", succeeded.Load(), totalReserved)
	}
}

func capacityAt(onHand, reserved int) services.LevelCapacity {
	return services.LevelCapacity{LevelId: uuid.New(), LocationId: uuid.New(), OnHand: onHand, Reserved: reserved}
}

type lockedStockLevels struct {
	mutex  sync.Mutex
	levels []services.LevelCapacity
}

func (stock *lockedStockLevels) reserve(quantity int) bool {
	stock.mutex.Lock()
	defer stock.mutex.Unlock()
	allocations, enough := services.AllocateAcrossLocations(stock.levels, quantity)
	if !enough {
		return false
	}
	for _, allocation := range allocations {
		for index := range stock.levels {
			if stock.levels[index].LevelId == allocation.LevelId {
				stock.levels[index].Reserved += allocation.Quantity
			}
		}
	}
	return true
}
