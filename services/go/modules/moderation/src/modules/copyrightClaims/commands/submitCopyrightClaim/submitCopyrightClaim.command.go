package submitcopyrightclaim

type Command struct {
	ClaimantUserId     string
	IdempotencyKey     string
	TargetType         string
	TargetId           string
	WorkDescription    string
	OwnershipStatement string
	ContactEmail       string
	GoodFaith          bool
	ClaimantName       string
	Organization       string
	RepresentativeOf   string
	ClaimedUrls        []string
	WorkType           string
}

type Result struct {
	ClaimId  string `json:"claimId"`
	Status   string `json:"status"`
	Replayed bool   `json:"-"`
}
