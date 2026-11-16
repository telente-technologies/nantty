package middlewares_test

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/loaders"
	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/ledger/src/migrations"
)

func TestMoneyActionStepUpIsSingleUseEvenUnderConcurrentRequests(t *testing.T) {
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	schema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "stepup", migrations.Files)
	authority := moneytesting.NewTestTokenAuthority(t)
	verifiers := *authority.StaffVerifiers()
	verifiers.SingleUse = loaders.NewStepUpLedger(database, schema)
	var served atomic.Int32
	handler := middlewares.RequireStaffPermissionWithSingleUseStepUp(verifiers, "money.withdrawals.process")(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		served.Add(1)
		writer.WriteHeader(http.StatusOK)
	}))
	windowHandler := middlewares.RequireStaffPermission(verifiers, "money.withdrawals.process", true)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) }))
	staff := authority.StaffTokens("staff-1", "money.withdrawals.process")
	call := func(target http.Handler, stepUpToken string) int {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/withdrawals/w1/review", nil)
		request.Header.Set("Authorization", "Bearer "+staff.AccessToken)
		request.Header.Set("X-Step-Up-Token", stepUpToken)
		recorder := httptest.NewRecorder()
		target.ServeHTTP(recorder, request)
		return recorder.Code
	}
	if status := call(handler, staff.StepUpToken); status != http.StatusOK {
		t.Fatalf("the first use of a step-up is accepted: %d", status)
	}
	if status := call(handler, staff.StepUpToken); status != http.StatusUnauthorized {
		t.Fatalf("a replayed step-up must get 401 STEP_UP_REUSED, got %d", status)
	}
	if status := call(windowHandler, staff.StepUpToken); status != http.StatusOK {
		t.Fatalf("non-money actions keep the reusable step-up window, got %d", status)
	}
	fresh := authority.StaffTokens("staff-1", "money.withdrawals.process").StepUpToken
	var waitGroup sync.WaitGroup
	statuses := make([]int, 8)
	for index := range statuses {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			statuses[index] = call(handler, fresh)
		}()
	}
	waitGroup.Wait()
	accepted := 0
	for _, status := range statuses {
		if status == http.StatusOK {
			accepted++
		} else if status != http.StatusUnauthorized {
			t.Fatalf("concurrent replays are refused with 401, got %d", status)
		}
	}
	if accepted != 1 || served.Load() != 2 {
		t.Fatalf("exactly one concurrent use succeeds: accepted %d, served %d", accepted, served.Load())
	}
}
