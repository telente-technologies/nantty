package models

import "time"

type PrivacySettings struct {
	Essential       bool
	Analytics       bool
	Personalization bool
	PersonalizedAds bool
	Marketing       bool
	PolicyVersion   string
	UpdatedAt       *time.Time
}
