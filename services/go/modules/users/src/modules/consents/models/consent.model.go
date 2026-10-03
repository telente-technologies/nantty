package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	TypeEssential       = "essential"
	TypeAnalytics       = "analytics"
	TypePersonalization = "personalization"
	TypeAdvertising     = "advertising"
	TypeMarketing       = "marketing"

	StatusGranted   = "granted"
	StatusWithdrawn = "withdrawn"
	StatusUndecided = "undecided"

	PolicyPrivacy = "privacy_policy"
	PolicyCookie  = "cookie_policy"
	PolicyTerms   = "terms"
)

var OptionalConsentTypes = []string{TypeAnalytics, TypePersonalization, TypeAdvertising, TypeMarketing}

type Subject struct {
	AccountId *uuid.UUID
	DeviceId  string
}

type Decision struct {
	ConsentType string
	Granted     bool
}

type RequestMetadata struct {
	IpAddress string
	UserAgent string
	Source    string
}

type DecisionChange struct {
	ConsentType string
	Granted     bool
}

type ConsentState struct {
	ConsentType   string
	Status        string
	PolicyVersion string
	DecidedAt     *time.Time
}
