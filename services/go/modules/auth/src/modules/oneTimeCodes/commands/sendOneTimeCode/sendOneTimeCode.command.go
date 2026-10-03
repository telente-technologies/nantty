package sendonetimecode

type Command struct {
	Destination string
	Purpose     string
}

type Result struct {
	ExpiresIn int `json:"expiresIn"`
}
