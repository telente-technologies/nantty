package services

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

func capacityAt(onHand, reserved int) LevelCapacity {
	return LevelCapacity{LevelId: uuid.New(), LocationId: uuid.New(), OnHand: onHand, Reserved: reserved}
}

func TestAllocateAcrossLocationsPrefersMostAvailableStockFirst(t *testing.T) {
	small, large := capacityAt(3, 0), capacityAt(10, 2)
	allocations, enough := AllocateAcrossLocations([]LevelCapacity{small, large}, 9)
	if !enough || len(allocations) != 2 {
		t.Fatalf("expected two allocations covering the request, got %+v enough=%v", allocations, enough)
	}
	if allocations[0].LevelId != large.LevelId || allocations[0].Quantity != 8 {
		t.Fatalf("expected the larger location to be drained first, got %+v", allocations[0])
	}
	if allocations[1].LevelId != small.LevelId || allocations[1].Quantity != 1 {
		t.Fatalf("expected the remainder from the smaller location, got %+v", allocations[1])
	}
}

func TestAllocateAcrossLocationsRejectsWhenStockIsShort(t *testing.T) {
	cases := []struct {
		name     string
		levels   []LevelCapacity
		quantity int
		enough   bool
	}{
		{"exact fit", []LevelCapacity{capacityAt(5, 0)}, 5, true},
		{"one short", []LevelCapacity{capacityAt(5, 1)}, 5, false},
		{"reserved stock is not sellable", []LevelCapacity{capacityAt(5, 5)}, 1, false},
		{"over reserved levels count as zero", []LevelCapacity{capacityAt(2, 4), capacityAt(3, 0)}, 3, true},
		{"nothing requested", []LevelCapacity{capacityAt(5, 0)}, 0, false},
		{"no levels", nil, 1, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, enough := AllocateAcrossLocations(testCase.levels, testCase.quantity); enough != testCase.enough {
				t.Fatalf("enough = %v, want %v", enough, testCase.enough)
			}
		})
	}
}

type lockedStockLevels struct {
	mutex  sync.Mutex
	levels []LevelCapacity
}

func (stock *lockedStockLevels) reserve(quantity int) bool {
	stock.mutex.Lock()
	defer stock.mutex.Unlock()
	allocations, enough := AllocateAcrossLocations(stock.levels, quantity)
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

func TestConcurrentReservationsNeverOversell(t *testing.T) {
	stock := &lockedStockLevels{levels: []LevelCapacity{capacityAt(30, 0), capacityAt(20, 0)}}
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

func TestMergeStockLinesCombinesDuplicateVariantsInStableOrder(t *testing.T) {
	first, second := uuid.MustParse("00000000-0000-0000-0000-000000000002"), uuid.MustParse("00000000-0000-0000-0000-000000000001")
	merged, err := mergeStockLines([]commerceports.StockLine{{VariantId: first, Quantity: 2}, {VariantId: second, Quantity: 1}, {VariantId: first, Quantity: 3}})
	if err != nil || len(merged) != 2 {
		t.Fatalf("merge failed: %v %+v", err, merged)
	}
	if merged[0].VariantId != second || merged[1].Quantity != 5 {
		t.Fatalf("unexpected merge result %+v", merged)
	}
	if _, err := mergeStockLines([]commerceports.StockLine{{VariantId: first, Quantity: 0}}); err == nil {
		t.Fatal("expected zero quantity to be rejected")
	}
}
