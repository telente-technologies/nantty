package applyrefundoutcome

import verificationevents "zudomart/modules/users/src/modules/identityVerification/events"

type Command struct {
	EventType    string
	CaseId       string                    `json:"caseId"`
	RefundAmount *verificationevents.Money `json:"refundAmount"`
}
