package dtos

type SurfaceState struct {
	App     bool `json:"app"`
	Profile bool `json:"profile"`
}

type BirthdayCelebration struct {
	Today bool         `json:"today"`
	Age   int          `json:"age,omitempty"`
	Shown SurfaceState `json:"shown"`
}

type AnniversaryStats struct {
	Followers *int `json:"followers,omitempty"`
	Orders    *int `json:"orders,omitempty"`
}

type AnniversaryCelebration struct {
	Today bool              `json:"today"`
	Years int               `json:"years,omitempty"`
	Shown SurfaceState      `json:"shown"`
	Stats *AnniversaryStats `json:"stats,omitempty"`
}

type ViewerCelebrations struct {
	Timezone                string                 `json:"timezone"`
	TimezoneConfigured      bool                   `json:"timezoneConfigured"`
	LocalDate               string                 `json:"localDate"`
	BirthdayBalloonsVisible bool                   `json:"birthdayBalloonsVisible"`
	Birthday                BirthdayCelebration    `json:"birthday"`
	Anniversary             AnniversaryCelebration `json:"anniversary"`
}

type PublicFlags struct {
	BirthdayToday    bool
	AnniversaryToday bool
}

type MarkSeenRequest struct {
	Kind    string `json:"kind"`
	Surface string `json:"surface"`
}

type UpdateSettingsRequest struct {
	Timezone                *string `json:"timezone"`
	BirthdayBalloonsVisible *bool   `json:"birthdayBalloonsVisible"`
}
