package models

import (
	"slices"
	"strings"
)

type OnboardingReason struct {
	Step    string `json:"step"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type OnboardingBankSummary struct {
	BankName     string `json:"bankName"`
	AccountLast4 string `json:"accountLast4"`
	AccountName  string `json:"accountName"`
}

type PayoutOnboardingState struct {
	Role                    string                 `json:"role"`
	Status                  string                 `json:"status"`
	CurrentStep             string                 `json:"currentStep"`
	CompletedSteps          []string               `json:"completedSteps"`
	RequiresBusinessStep    bool                   `json:"requiresBusinessStep"`
	RequiresDocumentStep    bool                   `json:"requiresDocumentStep"`
	LegalName               string                 `json:"legalName"`
	IdType                  string                 `json:"idType"`
	IdLast4                 string                 `json:"idLast4"`
	BankSummary             *OnboardingBankSummary `json:"bankSummary"`
	DocumentStatus          string                 `json:"documentStatus"`
	AccountStatus           string                 `json:"accountStatus"`
	SyncByStep              map[string]string      `json:"syncByStep"`
	EarningsPendingTransfer MoneyView              `json:"earningsPendingTransfer"`
	PendingWithdrawable     MoneyView              `json:"pendingWithdrawable"`
	ReviewEstimate          string                 `json:"reviewEstimate"`
	Reasons                 []OnboardingReason     `json:"reasons"`
	VerifiedVia             *string                `json:"verifiedVia"`
	WithdrawalsEnabled      bool                   `json:"withdrawalsEnabled"`
	FirstEarningsUnlockAt   *string                `json:"firstEarningsUnlockAt"`
}

type OnboardingJobSnapshot struct {
	Step         string
	Status       string
	AttemptCount int
	LastError    string
}

type PayoutOnboardingInputs struct {
	Role                string
	CompletedSteps      []string
	RegisteredBusiness  bool
	AccountRowStatus    string
	VerificationStatus  string
	VerificationReasons []OnboardingReason
	PayoutsActive       bool
	AccountRoles        []string
	LatestJobs          []OnboardingJobSnapshot
	DocumentStatus      string
}

func MapPayoutAccountStatus(rowStatus, verificationStatus string) string {
	switch {
	case rowStatus == "" || rowStatus == "pending_creation":
		return "pending_creation"
	case rowStatus == "failed":
		return "failed"
	case verificationStatus == "actionNeeded":
		return "actionRequired"
	case verificationStatus == "documentsRequired":
		return "documentsRequired"
	case verificationStatus == "verified":
		return "verified"
	}
	return "underReview"
}

func syncStatusForJob(job OnboardingJobSnapshot, _ bool) string {
	switch {
	case job.Status == "succeeded":
		return "done"
	case job.Status == "failed" || (job.Status == "queued" && job.AttemptCount > 0 && job.LastError != ""):
		return "needs_attention"
	case job.Status == "running" || job.Status == "queued":
		return "sending"
	}
	return "saved"
}

func BuildPayoutOnboardingState(inputs PayoutOnboardingInputs) PayoutOnboardingState {
	accountStatus := MapPayoutAccountStatus(inputs.AccountRowStatus, inputs.VerificationStatus)
	state := PayoutOnboardingState{
		Role: inputs.Role, CompletedSteps: append([]string{}, inputs.CompletedSteps...), RequiresBusinessStep: inputs.RegisteredBusiness,
		AccountStatus: accountStatus, SyncByStep: map[string]string{}, Reasons: append([]OnboardingReason{}, inputs.VerificationReasons...),
	}
	if inputs.AccountRowStatus == "" {
		state.AccountStatus = "pending_creation"
	}
	stepByJob := map[string]string{JobStepCreateRecipient: "bank", JobStepCreateSettlementSubaccount: "bank", JobStepCreateEscrowSubaccount: "bank"}
	needsAttention := accountStatus == "failed"
	for _, step := range []string{"identity", "business"} {
		if slices.Contains(state.CompletedSteps, step) {
			state.SyncByStep[step] = "done"
		}
	}
	syncRank := map[string]int{"done": 0, "saved": 1, "sending": 2, "needs_attention": 3}
	for _, job := range inputs.LatestJobs {
		step, shown := stepByJob[job.Step]
		if !shown {
			continue
		}
		sync := syncStatusForJob(job, inputs.AccountRowStatus == "created")
		if current, seen := state.SyncByStep[step]; seen && syncRank[current] >= syncRank[sync] {
			continue
		}
		state.SyncByStep[step] = sync
	}
	for step, sync := range state.SyncByStep {
		if sync == "needs_attention" {
			needsAttention = true
			state.Reasons = append(state.Reasons, OnboardingReason{Step: step, Code: "SYNC_FAILED", Message: "We could not send this step yet. Tap Try again."})
		}
	}
	state.CurrentStep = nextOnboardingStep(state.CompletedSteps, inputs.RegisteredBusiness, accountStatus)
	state.DocumentStatus = documentStatusFor(accountStatus)
	state.RequiresDocumentStep = accountStatus == "documentsRequired"
	if state.RequiresDocumentStep {
		state.DocumentStatus = firstNonEmpty(inputs.DocumentStatus, "not_started")
		if state.DocumentStatus == "approved" || state.DocumentStatus == "in_review" {
			state.DocumentStatus = "not_started"
		}
	}
	verified := accountStatus == "verified"
	state.WithdrawalsEnabled = verified && inputs.PayoutsActive
	if verified && len(inputs.AccountRoles) > 0 {
		via := inputs.AccountRoles[0]
		state.VerifiedVia = &via
	}
	switch {
	case len(state.CompletedSteps) == 0 && inputs.AccountRowStatus == "":
		state.Status = "not_started"
	case verified:
		state.Status = "verified"
	case needsAttention || accountStatus == "actionRequired" || accountStatus == "documentsRequired":
		state.Status = "action_needed"
	case state.CurrentStep == "done" || state.CurrentStep == "verify" && accountStatus == "underReview":
		state.Status = "pending_review"
	default:
		state.Status = "in_progress"
	}
	return state
}

func nextOnboardingStep(completed []string, registeredBusiness bool, accountStatus string) string {
	for _, step := range []string{"identity", "business", "bank"} {
		if step == "business" && !registeredBusiness {
			continue
		}
		if !slices.Contains(completed, step) {
			return step
		}
	}
	if accountStatus == "documentsRequired" {
		return "document"
	}
	return "done"
}

func documentStatusFor(accountStatus string) string {
	switch accountStatus {
	case "underReview":
		return "in_review"
	case "verified":
		return "approved"
	case "actionRequired":
		return "rejected"
	}
	return "not_required"
}

func NamesMatchIgnoringOrderAndCase(first, second string) bool {
	normalize := func(name string) []string {
		parts := strings.Fields(strings.ToLower(strings.NewReplacer(",", " ", ".", " ", "-", " ").Replace(name)))
		slices.Sort(parts)
		return parts
	}
	left, right := normalize(first), normalize(second)
	return len(left) > 0 && slices.Equal(left, right)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
