package jobs

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/moderation/src/container"
	platformevents "nantty/platform/events"
)

func TestDuplicateBankAccountHandlerIgnoresOtherEventsAndNonAdvisoryData(t *testing.T) {
	handler := DuplicateBankAccountEnvelopeHandler(&container.Container{})
	for _, body := range []string{
		`{"id":"1","type":"report.created","data":{}}`,
		`{"id":"2","type":"payoutAccount.duplicateBankAccount","data":{"userId":"a","suggestionId":"s","signals":["bank_account_shared_with_another_store"],"advisoryOnly":false}}`,
		`{"id":"3","type":"payoutAccount.duplicateBankAccount","data":{"userId":"a","suggestionId":"","signals":["x"],"advisoryOnly":true}}`,
	} {
		if err := handler(context.Background(), []byte(body)); err != nil {
			t.Fatalf("%s: %v", body, err)
		}
	}
	if err := handler(context.Background(), []byte(`{"id":"4","type":"payoutAccount.duplicateBankAccount","data":"oops"}`)); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("malformed data is poison, got %v", err)
	}
}
