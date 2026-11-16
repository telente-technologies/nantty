package privacy_test

import (
	"context"
	"testing"

	exportservices "nantty/modules/users/src/modules/dataExport/services"
)

func TestExpirySweepAndWorkerDoNotTouchObjectStorageWhenIdle(t *testing.T) {
	harness := startPrivacyHarness(t)
	touched := false
	provider := func(context.Context) (exportservices.ObjectStore, error) {
		touched = true
		return newMemoryObjectStore(), nil
	}
	if expired, err := exportservices.ExpireReadyExports(context.Background(), harness.container, provider); err != nil || expired != 0 || touched {
		t.Fatalf("idle sweep must not open object storage: expired=%d err=%v touched=%v", expired, err, touched)
	}
	claimed, err := exportservices.ClaimNextExportRequest(context.Background(), harness.container)
	if err != nil || claimed != nil {
		t.Fatalf("no queued export, nothing to claim: %v %v", claimed, err)
	}
}
