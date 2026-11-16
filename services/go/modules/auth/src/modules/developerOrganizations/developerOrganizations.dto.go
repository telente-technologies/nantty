package developerorganizations

import (
	"encoding/json"
	"time"
)

type CreateRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

type TransferOwnershipRequest struct {
	MemberID     string `json:"memberId"`
	Confirmation string `json:"confirmation"`
}

type TransferOwnershipResult struct {
	PreviousOwnerMembershipID string `json:"previousOwnerMembershipId"`
	NewOwnerMembershipID      string `json:"newOwnerMembershipId"`
}

type CreateInvitationRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type OrganizationInvitation struct {
	ID               string    `json:"id"`
	OrganizationID   string    `json:"organizationId"`
	OrganizationName string    `json:"organizationName"`
	OrganizationSlug string    `json:"organizationSlug"`
	InviteeEmail     string    `json:"inviteeEmail,omitempty"`
	InviterName      string    `json:"inviterName,omitempty"`
	Role             string    `json:"role"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	ExpiresAt        time.Time `json:"expiresAt"`
}

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type OrganizationAccess struct {
	OrganizationID                  string   `json:"organizationId"`
	Role                            string   `json:"role"`
	OrganizationCapabilities        []string `json:"organizationCapabilities"`
	ApplicationCapabilities         []string `json:"applicationCapabilities"`
	EligibleApplicationCapabilities []string `json:"eligibleApplicationCapabilities"`
	ApplicationGrantRequired        bool     `json:"applicationGrantRequired"`
}

type OrganizationRole struct {
	Name                     string   `json:"name"`
	OrganizationCapabilities []string `json:"organizationCapabilities"`
	ApplicationCapabilities  []string `json:"applicationCapabilities"`
}

type OrganizationMember struct {
	MembershipID string    `json:"membershipId"`
	AccountID    string    `json:"accountId"`
	Username     string    `json:"username"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	Status       string    `json:"status"`
	JoinedAt     time.Time `json:"joinedAt"`
}

type OrganizationMemberDetail struct {
	OrganizationMember
	OrganizationRole OrganizationRole `json:"organizationAccess"`
}

type OrganizationAuditEntry struct {
	ID             string          `json:"id"`
	ActorAccountID string          `json:"actorAccountId"`
	ActorRole      string          `json:"actorRole"`
	Action         string          `json:"action"`
	SubjectType    string          `json:"subjectType"`
	SubjectID      string          `json:"subjectId"`
	BeforeState    json.RawMessage `json:"beforeState"`
	AfterState     json.RawMessage `json:"afterState"`
	CreatedAt      time.Time       `json:"createdAt"`
}
