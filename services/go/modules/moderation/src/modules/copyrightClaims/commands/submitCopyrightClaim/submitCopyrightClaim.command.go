package submitcopyrightclaim

import "nantty/modules/moderation/src/modules/copyrightClaims/validators"

type Command struct {
	ClaimantUserId      string
	IdempotencyKey      string
	TargetType          string
	TargetId            string
	WorkDescription     string
	OwnershipStatement  string
	ContactEmail        string
	GoodFaith           bool
	ClaimantName        string
	Organization        string
	RepresentativeOf    string
	ClaimedUrls         []string
	WorkType            string
	ClaimScope          string
	ClaimantPhone       string
	ClaimantAddress     string
	OriginalWorkUrl     string
	OriginalWorkMediaId string
	ProofUrls           []string
	ProofMediaIds       []string
	Segments            []validators.Segment
	AccuracyDeclared    bool
	SignatureName       string
}

type Result struct {
	ClaimId  string `json:"claimId"`
	Status   string `json:"status"`
	Replayed bool   `json:"-"`
}
