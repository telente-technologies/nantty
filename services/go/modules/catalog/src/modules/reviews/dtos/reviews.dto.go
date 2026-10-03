package dtos

type SubmitReviewRequest struct {
	Rating int     `json:"rating"`
	Text   string  `json:"text"`
	Title  *string `json:"title"`
}

type ReplyRequest struct {
	Body string `json:"body"`
}

type ReportRequest struct {
	Reason  string  `json:"reason"`
	Details *string `json:"details"`
}
