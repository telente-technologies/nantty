package developerorganizations

type roleCapabilities struct {
	organization []string
	application  []string
}

var developerRoleCapabilities = map[string]roleCapabilities{
	"owner": {
		organization: []string{"organization.read", "organization.manage", "members.manage", "billing.read", "billing.manage", "security.manage"},
		application:  []string{"applications.manage", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"},
	},
	"admin": {
		organization: []string{"organization.read", "organization.manage", "members.manage"},
		application:  []string{"applications.manage", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"},
	},
	"developer": {
		organization: []string{"organization.read"},
		application:  []string{"applications.read", "credentials.manage", "webhooks.manage", "request_logs.read", "usage.read"},
	},
	"analyst": {
		organization: []string{"organization.read"},
		application:  []string{"request_logs.read", "usage.read"},
	},
	"billing": {
		organization: []string{"organization.read", "billing.read", "billing.manage"},
	},
}

var supportedOrganizationRoles = []string{"owner", "admin", "developer", "analyst", "billing"}

func capabilitiesForRole(role string) ([]string, []string) {
	capabilities, found := developerRoleCapabilities[role]
	if !found {
		return []string{}, []string{}
	}
	return append([]string{}, capabilities.organization...), append([]string{}, capabilities.application...)
}

func AllowsOrganizationCapability(role, capability string) bool {
	capabilities, found := developerRoleCapabilities[role]
	return found && containsCapability(capabilities.organization, capability)
}

func AllowsApplicationCapability(role, capability string, hasApplicationGrant bool) bool {
	capabilities, found := developerRoleCapabilities[role]
	return found && hasApplicationGrant && containsCapability(capabilities.application, capability)
}

func CanAssignOrganizationRole(actorRole, targetRole string) bool {
	if targetRole == "owner" {
		return false
	}
	switch actorRole {
	case "owner":
		return containsCapability(supportedOrganizationRoles, targetRole)
	case "admin":
		return targetRole == "admin" || targetRole == "developer" || targetRole == "analyst"
	default:
		return false
	}
}

func containsCapability(capabilities []string, capability string) bool {
	for _, current := range capabilities {
		if current == capability {
			return true
		}
	}
	return false
}
