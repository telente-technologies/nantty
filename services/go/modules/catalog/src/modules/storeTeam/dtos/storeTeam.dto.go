package dtos

type StaffMemberView struct {
	Id           string   `json:"id"`
	UserId       string   `json:"userId"`
	Name         string   `json:"name"`
	Username     string   `json:"username"`
	AvatarUrl    *string  `json:"avatarUrl"`
	Role         string   `json:"role"`
	Status       string   `json:"status"`
	Permissions  []string `json:"permissions"`
	LocationIds  []string `json:"locationIds"`
	LastActiveAt *string  `json:"lastActiveAt"`
	InvitedAt    string   `json:"invitedAt"`
}

type NanttyUserCandidateView struct {
	UserId    string  `json:"userId"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
}

type CandidateList struct {
	Data []NanttyUserCandidateView `json:"data"`
}

type AuditActorView struct {
	Id   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

type AuditLogEntryView struct {
	Id         string         `json:"id"`
	Actor      AuditActorView `json:"actor"`
	Action     string         `json:"action"`
	TargetType string         `json:"targetType"`
	TargetId   *string        `json:"targetId"`
	Summary    string         `json:"summary"`
	IpAddress  *string        `json:"ipAddress"`
	CreatedAt  string         `json:"createdAt"`
}

type CreateStaffRequest struct {
	UserId      string    `json:"userId"`
	Role        string    `json:"role"`
	LocationIds []string  `json:"locationIds"`
	Permissions *[]string `json:"permissions"`
}

type UpdateStaffRequest struct {
	Name        *string      `json:"name"`
	Role        *string      `json:"role"`
	Status      *string      `json:"status"`
	LocationIds *[]string    `json:"locationIds"`
	Permissions NullableList `json:"permissions"`
}

type TeamRequestView struct {
	Id        string  `json:"id"`
	StoreId   string  `json:"storeId"`
	StoreName string  `json:"storeName"`
	StoreLogo *string `json:"storeLogoUrl"`
	Role      string  `json:"role"`
	InvitedAt string  `json:"invitedAt"`
}

var StaffRoles = []string{"manager", "inventory", "sales", "accountant"}
