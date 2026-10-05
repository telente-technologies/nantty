package previewusernameconfusables

type Collision struct {
	EntryId   string `json:"entryId"`
	Value     string `json:"value"`
	Kind      string `json:"kind"`
	Category  string `json:"category"`
	MatchedBy string `json:"matchedBy"`
}

type Result struct {
	Candidate       string      `json:"candidate"`
	Normalized      string      `json:"normalized"`
	Skeleton        string      `json:"skeleton"`
	Collisions      []Collision `json:"collisions"`
	TakenByUserId   *string     `json:"takenByUserId"`
	TakenByUsername *string     `json:"takenByUsername"`
	IsWithheld      bool        `json:"isWithheld"`
}
