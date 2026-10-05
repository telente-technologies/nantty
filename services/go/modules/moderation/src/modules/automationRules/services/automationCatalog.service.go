package services

type CatalogField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Type  string `json:"type"`
}

type CatalogEvent struct {
	Key       string         `json:"key"`
	Label     string         `json:"label"`
	Fields    []CatalogField `json:"fields"`
	HasTarget bool           `json:"-"`
}

type CatalogLabel struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

type CatalogAction struct {
	Type       string         `json:"type"`
	Label      string         `json:"label"`
	Parameters []CatalogLabel `json:"parameters"`
}

type Catalog struct {
	Events    []CatalogEvent  `json:"events"`
	Operators []CatalogLabel  `json:"operators"`
	Actions   []CatalogAction `json:"actions"`
}

type SampleEvent struct {
	Id      string         `json:"id"`
	Event   string         `json:"event"`
	Label   string         `json:"label"`
	Payload map[string]any `json:"payload"`
}

const (
	EventReportCreated         = "report.created"
	EventStoreCreated          = "store.created"
	EventVerificationSubmitted = "verificationApplication.submitted"
	EventMessageSent           = "message.sent"
	ActionHideTarget           = "hide_target"
	ActionQueueForReview       = "queue_for_review"
	ActionFlagUser             = "flag_user"
	MaximumConditions          = 10
	MaximumActions             = 5
)

var accountRiskFields = []CatalogField{
	{Key: "accountAgeDays", Label: "Account age in days", Type: "number"},
	{Key: "moderationStrikes", Label: "Active moderation strikes", Type: "number"},
	{Key: "accountStatus", Label: "Account status", Type: "text"},
	{Key: "riskLevel", Label: "Risk level", Type: "text"},
	{Key: "isVerified", Label: "Has a verification badge", Type: "boolean"},
	{Key: "hasPhone", Label: "Has a phone number", Type: "boolean"},
}

var priorityParameter = []CatalogLabel{{Key: "priority", Label: "Priority (0-100)"}}

var catalog = Catalog{
	Events: []CatalogEvent{
		{Key: EventReportCreated, Label: "Report submitted", HasTarget: true, Fields: []CatalogField{
			{Key: "targetType", Label: "Target type", Type: "text"}, {Key: "targetId", Label: "Target ID", Type: "text"}, {Key: "targetOwnerId", Label: "Target owner ID", Type: "text"},
			{Key: "reporterId", Label: "Reporter ID", Type: "text"}, {Key: "reason", Label: "Reason", Type: "text"},
		}},
		{Key: EventStoreCreated, Label: "Store created", Fields: append([]CatalogField{
			{Key: "storeId", Label: "Store ID", Type: "text"}, {Key: "ownerId", Label: "Owner ID", Type: "text"}, {Key: "countryCode", Label: "Country", Type: "text"}, {Key: "currency", Label: "Currency", Type: "text"},
		}, accountRiskFields...)},
		{Key: EventVerificationSubmitted, Label: "Verification application submitted", Fields: append([]CatalogField{
			{Key: "applicationId", Label: "Application ID", Type: "text"}, {Key: "userId", Label: "Applicant ID", Type: "text"}, {Key: "color", Label: "Badge colour", Type: "text"},
		}, accountRiskFields...)},
		{Key: EventMessageSent, Label: "Message sent", Fields: []CatalogField{
			{Key: "senderId", Label: "Sender ID", Type: "text"}, {Key: "conversationId", Label: "Conversation ID", Type: "text"}, {Key: "messageKind", Label: "Message kind", Type: "text"},
			{Key: "recipientCount", Label: "Recipients", Type: "number"}, {Key: "isNewConversation", Label: "Starts a new conversation", Type: "boolean"},
		}},
	},
	Operators: []CatalogLabel{
		{Key: "EQUALS", Label: "is"}, {Key: "NOT_EQUALS", Label: "is not"}, {Key: "GREATER_THAN", Label: "is greater than"},
		{Key: "LESS_THAN", Label: "is less than"}, {Key: "CONTAINS", Label: "contains"}, {Key: "IN", Label: "is one of (comma separated)"},
	},
	Actions: []CatalogAction{
		{Type: ActionHideTarget, Label: "Hide the content until reviewed", Parameters: priorityParameter},
		{Type: ActionQueueForReview, Label: "Add the content to the review queue", Parameters: priorityParameter},
		{Type: ActionFlagUser, Label: "Flag the user for review", Parameters: priorityParameter},
	},
}

var sampleEvents = []SampleEvent{
	{Id: "sample_report_scam", Event: EventReportCreated, Label: "Scam report on a product", Payload: map[string]any{"targetType": "product", "targetId": "prd_sample", "targetOwnerId": "usr_seller", "reporterId": "usr_reporter", "reason": "scam"}},
	{Id: "sample_report_violence", Event: EventReportCreated, Label: "Violence report on a clip", Payload: map[string]any{"targetType": "clip", "targetId": "clp_sample", "targetOwnerId": "usr_creator", "reporterId": "usr_reporter", "reason": "violence"}},
	{Id: "sample_store_new_account", Event: EventStoreCreated, Label: "Store opened by a 2-day-old account", Payload: map[string]any{"storeId": "str_sample", "ownerId": "usr_new", "countryCode": "NG", "currency": "NGN", "accountAgeDays": 2, "moderationStrikes": 0, "accountStatus": "ACTIVE", "riskLevel": "HIGH", "isVerified": false, "hasPhone": false}},
	{Id: "sample_verification_struck", Event: EventVerificationSubmitted, Label: "Gold application from an account with 2 strikes", Payload: map[string]any{"applicationId": "app_sample", "userId": "usr_applicant", "color": "GOLD", "accountAgeDays": 400, "moderationStrikes": 2, "accountStatus": "WARNED", "riskLevel": "MEDIUM", "isVerified": false, "hasPhone": true}},
	{Id: "sample_message_blast", Event: EventMessageSent, Label: "New conversation with 40 recipients", Payload: map[string]any{"senderId": "usr_sender", "conversationId": "cnv_sample", "messageKind": "text", "recipientCount": 40, "isNewConversation": true}},
}

func DescribeCatalog() Catalog { return catalog }

func ListSampleEvents() []SampleEvent { return sampleEvents }

func FindCatalogEvent(key string) (CatalogEvent, bool) {
	for _, event := range catalog.Events {
		if event.Key == key {
			return event, true
		}
	}
	return CatalogEvent{}, false
}

func FindCatalogAction(actionType string) (CatalogAction, bool) {
	for _, action := range catalog.Actions {
		if action.Type == actionType {
			return action, true
		}
	}
	return CatalogAction{}, false
}
