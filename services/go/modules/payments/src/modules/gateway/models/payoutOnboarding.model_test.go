package models

import (
	"testing"
	"time"
)

func TestConnectedAccountJobBackoffScheduleStopsAfterTheLastStep(t *testing.T) {
	expected := []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour, 6 * time.Hour}
	for attempt, want := range expected {
		delay, retry := NextConnectedAccountJobAttemptDelay(attempt + 1)
		if !retry || delay != want {
			t.Fatalf("attempt %d: got %v %v", attempt+1, delay, retry)
		}
	}
	if _, retry := NextConnectedAccountJobAttemptDelay(len(expected) + 1); retry {
		t.Fatal("the job must dead-letter after the last backoff step")
	}
}

func TestConnectedAccountJobKeysAreStablePerStepAndVersion(t *testing.T) {
	cases := map[string]string{
		ConnectedAccountJobIdempotencyKey(JobStepCreateRecipient, "user-1", 4):            "createRecipient:user-1:4",
		ConnectedAccountJobIdempotencyKey(JobStepCreateSettlementSubaccount, "user-1", 1): "createSettlementSubaccount:user-1:1",
	}
	for got, want := range cases {
		if got != want {
			t.Fatalf("got %s want %s", got, want)
		}
	}
}

func TestPayoutOnboardingStateFollowsTheAccountAndSteps(t *testing.T) {
	cases := []struct {
		name                       string
		inputs                     PayoutOnboardingInputs
		status, step, account, doc string
		withdrawals                bool
	}{
		{"nothing yet", PayoutOnboardingInputs{Role: "creator"}, "not_started", "identity", "pending_creation", "not_required", false},
		{"identity saved, no bank yet", PayoutOnboardingInputs{CompletedSteps: []string{"identity"}, AccountRowStatus: "pending_creation"}, "in_progress", "bank", "pending_creation", "not_required", false},
		{"bank sending while paystack is down", PayoutOnboardingInputs{CompletedSteps: []string{"identity", "bank"}, AccountRowStatus: "pending_creation",
			LatestJobs: []OnboardingJobSnapshot{{Step: JobStepCreateRecipient, Status: "queued", AttemptCount: 1, LastError: "502"}}}, "action_needed", "done", "pending_creation", "not_required", false},
		{"recipient failed for good", PayoutOnboardingInputs{CompletedSteps: []string{"identity", "bank"}, AccountRowStatus: "failed",
			LatestJobs: []OnboardingJobSnapshot{{Step: JobStepCreateRecipient, Status: "failed", AttemptCount: 5, LastError: "timeout"}}}, "action_needed", "done", "failed", "not_required", false},
		{"registered business needs the business step", PayoutOnboardingInputs{CompletedSteps: []string{"identity"}, RegisteredBusiness: true, AccountRowStatus: "created", VerificationStatus: "inProgress"}, "in_progress", "business", "underReview", "in_review", false},
		{"verified", PayoutOnboardingInputs{CompletedSteps: []string{"identity", "bank"}, AccountRowStatus: "created", VerificationStatus: "verified", PayoutsActive: true, AccountRoles: []string{"seller", "creator"},
			LatestJobs: []OnboardingJobSnapshot{{Step: JobStepCreateRecipient, Status: "succeeded"}, {Step: JobStepCreateSettlementSubaccount, Status: "succeeded"}}}, "verified", "done", "verified", "approved", true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			state := BuildPayoutOnboardingState(testCase.inputs)
			if state.Status != testCase.status || state.CurrentStep != testCase.step || state.AccountStatus != testCase.account || state.DocumentStatus != testCase.doc || state.WithdrawalsEnabled != testCase.withdrawals {
				t.Fatalf("state %+v", state)
			}
		})
	}
	state := BuildPayoutOnboardingState(PayoutOnboardingInputs{CompletedSteps: []string{"identity", "bank"}, AccountRowStatus: "created",
		LatestJobs: []OnboardingJobSnapshot{{Step: JobStepCreateRecipient, Status: "succeeded"}, {Step: JobStepCreateSettlementSubaccount, Status: "running"}}})
	if state.SyncByStep["identity"] != "done" || state.SyncByStep["bank"] != "sending" {
		t.Fatalf("sync %+v", state.SyncByStep)
	}
}

func TestBankNameMustMatchTheLegalNameIgnoringOrderAndCase(t *testing.T) {
	cases := []struct {
		left, right string
		want        bool
	}{
		{"Adeyemi Temitope", "TEMITOPE ADEYEMI", true},
		{"Temitope A. Adeyemi", "adeyemi temitope a", true},
		{"Temitope Adeyemi", "Temitope Adebayo", false},
		{"", "", false},
	}
	for _, testCase := range cases {
		if NamesMatchIgnoringOrderAndCase(testCase.left, testCase.right) != testCase.want {
			t.Fatalf("%q vs %q", testCase.left, testCase.right)
		}
	}
}

func TestPaystackOnboardingNeverAsksForAnIdDocument(t *testing.T) {
	for _, verification := range []string{"not_started", "documentsRequired", "inProgress", "underReview", "verified"} {
		state := BuildPayoutOnboardingState(PayoutOnboardingInputs{CompletedSteps: []string{"identity", "bank"}, AccountRowStatus: "created", VerificationStatus: verification, PayoutsActive: true})
		if state.RequiresDocumentStep || state.AccountStatus == "documentsRequired" || state.CurrentStep == "verify" || state.DocumentStatus == "required" {
			t.Fatalf("%s: %+v", verification, state)
		}
	}
}
