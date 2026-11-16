package orders_test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
)

func TestInvoiceNumbersAreUniqueAndSequentialUnderConcurrency(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	storeId := uuid.New()
	const parallel = 25
	numbers := make(chan string, parallel)
	failures := make(chan error, parallel)
	var group sync.WaitGroup
	for range parallel {
		group.Add(1)
		go func() {
			defer group.Done()
			err := module.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
				number, err := services.NextInvoiceNumber(ctx, tx, storeId)
				if err == nil {
					numbers <- number
				}
				return err
			})
			if err != nil {
				failures <- err
			}
		}()
	}
	group.Wait()
	close(numbers)
	close(failures)
	for err := range failures {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for number := range numbers {
		if seen[number] {
			t.Fatalf("duplicate invoice number %s", number)
		}
		seen[number] = true
	}
	if len(seen) != parallel {
		t.Fatalf("got %d numbers, want %d", len(seen), parallel)
	}
	for offset := range parallel {
		if !seen[fmt.Sprintf("INV-%d", 10001+offset)] {
			t.Fatalf("missing INV-%d: numbers must be sequential", 10001+offset)
		}
	}
}
