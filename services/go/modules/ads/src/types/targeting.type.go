package types

type LocationTarget struct {
	Type        string  `json:"type"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	CountryCode string  `json:"countryCode"`
	ParentName  *string `json:"parentName"`
}

type AudienceSpec struct {
	Locations                 []LocationTarget `json:"locations"`
	ExcludedLocations         []LocationTarget `json:"excludedLocations"`
	AgeMin                    int              `json:"ageMin"`
	AgeMax                    int              `json:"ageMax"`
	Gender                    string           `json:"gender"`
	TopicIds                  []string         `json:"topicIds"`
	BehaviourIds              []string         `json:"behaviourIds"`
	CustomAudienceIds         []string         `json:"customAudienceIds"`
	ExcludedCustomAudienceIds []string         `json:"excludedCustomAudienceIds"`
}

type Viewer struct {
	UserId            string
	Country           string
	Region            string
	AgeBand           string
	Gender            string
	Topics            []string
	PersonalizedAds   bool
	AgeRestricted     bool
	PremiumAdFree     bool
	CustomAudienceIds []string
}
