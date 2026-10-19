package releaseescrowbystaff

type Command struct {
	StaffId        string
	OrderId        string
	Reason         string
	IdempotencyKey string
}
