package services

import "time"

const (
	DefaultMaxExecutionsPerHour = 60
	OccurrenceRetention         = 8 * 24 * time.Hour
)

type Condition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type Action struct {
	Type       string            `json:"type"`
	Parameters map[string]string `json:"parameters"`
}

type Threshold struct {
	Count         int `json:"count"`
	WithinSeconds int `json:"withinSeconds"`
}

type RuleContent struct {
	Name                 string      `json:"name"`
	Description          string      `json:"description"`
	IsEnabled            bool        `json:"isEnabled"`
	Event                string      `json:"event"`
	ConditionMatch       string      `json:"conditionMatch"`
	Conditions           []Condition `json:"conditions"`
	Actions              []Action    `json:"actions"`
	Threshold            *Threshold  `json:"threshold"`
	CooldownSeconds      *int        `json:"cooldownSeconds"`
	MaxExecutionsPerHour int         `json:"maxExecutionsPerHour"`
}

type Rule struct {
	Id      string
	Version int
	Content RuleContent
}

type Event struct {
	Name          string
	SubjectKey    string
	SubjectLabel  string
	SourceEventId string
	Data          map[string]any
}

type Step struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Outcome string `json:"outcome"`
	Detail  string `json:"detail,omitempty"`
}

type ExecutionRecord struct {
	Rule       Rule
	Event      Event
	Status     string
	Steps      []Step
	ActionsRun []string
	Error      *string
	StartedAt  time.Time
	FinishedAt *time.Time
}

type ReservationLimits struct {
	CooldownSince  *time.Time
	OncePerSubject bool
	HourSince      time.Time
	MaxPerHour     int
}
