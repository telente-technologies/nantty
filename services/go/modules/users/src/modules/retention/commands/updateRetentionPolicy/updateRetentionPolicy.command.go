package updateretentionpolicy

type Command struct {
	Category         string
	Action           string
	RetentionDays    *int
	NeedsLegalReview bool
	ExpectedVersion  int
	Reason           string
	StaffId          string
	StaffRole        string
	IpAddress        string
	UserAgent        string
	RequestId        string
}
