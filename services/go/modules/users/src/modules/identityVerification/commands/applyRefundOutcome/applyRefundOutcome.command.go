package applyrefundoutcome

import verificationevents "nantty/modules/users/src/modules/identityVerification/events"

type Command struct {
	EventType    string
	CaseId       string                    `json:"caseId"`
	RefundAmount *verificationevents.Money `json:"refundAmount"`
}
