package services

import "slices"

type ActionRule struct {
	Permission      string
	NeedsStepUp     bool
	NeedsUser       bool
	ReporterNotice  bool
	ReporterOutcome string
}

var ActionRules = map[string]ActionRule{
	"DISMISS":        {Permission: "chat-reports:review", ReporterNotice: true, ReporterOutcome: "no_violation"},
	"WARN_USER":      {Permission: "users:moderate", NeedsUser: true, ReporterNotice: true, ReporterOutcome: "action_taken"},
	"RESTRICT_USER":  {Permission: "users:restrict", NeedsUser: true, ReporterNotice: true, ReporterOutcome: "action_taken"},
	"SUSPEND_USER":   {Permission: "users:suspend", NeedsUser: true, ReporterNotice: true, ReporterOutcome: "action_taken"},
	"BAN_USER":       {Permission: "users:ban", NeedsStepUp: true, NeedsUser: true, ReporterNotice: true, ReporterOutcome: "action_taken"},
	"REMOVE_GROUP":   {Permission: "chat-reports:review", NeedsStepUp: true, ReporterNotice: true, ReporterOutcome: "action_taken"},
	"ESCALATE_LEGAL": {Permission: "chat-reports:legal", NeedsStepUp: true},
}

var suspensionReasonCodes = map[string]string{
	"spam_or_scam": "SPAM_NETWORK", "fraud_or_payment_scam": "FRAUD", "harassment_or_bullying": "HARASSMENT", "hate": "HARASSMENT", "impersonation": "IMPERSONATION", "prohibited_items": "COUNTERFEIT",
}

func SuspensionReasonCodeFor(reason string) string {
	if code, mapped := suspensionReasonCodes[reason]; mapped {
		return code
	}
	return "OTHER"
}

func IsDecidedStatus(status string) bool {
	return slices.Contains([]string{"actioned", "dismissed", "escalated_legal"}, status)
}
