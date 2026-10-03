package changepassword

type Command struct {
	AccountId       string
	SessionId       string
	CurrentPassword string
	NewPassword     string
}
