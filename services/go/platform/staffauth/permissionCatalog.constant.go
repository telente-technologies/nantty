package staffauth

type DepartmentRoleTemplate struct {
	Key         string
	Name        string
	Department  string
	Permissions []string
}

var AllPermissionKeys = []string{
	"metrics:read",
	"users:read", "users:read-pii", "users:moderate", "users:restrict", "users:suspend", "users:ban", "users:delete",
	"usernames:reassign", "usernames:manage", "reserved-usernames:manage",
	"verification:review", "verification:documents", "verification:grant", "verification:revoke",
	"applications:sellers", "applications:creators",
	"brands:review", "brands:revoke", "ip-claims:review",
	"moderation:reports", "moderation:appeals", "chat-reports:review", "chat-reports:legal", "copyright:review",
	"security:cases",
	"orders:read", "disputes:resolve", "refunds:issue", "payouts:approve", "coins:review", "ledger:read",
	"ads:review", "advertisers:manage",
	"catalog:manage",
	"config:read", "config:plans", "config:revenue", "config:rules", "flags:manage", "automation:manage", "templates:manage",
	"support:tickets", "support:assign", "support:chat", "support:email", "support:helpContent",
	"marketing:campaigns", "marketing:email", "sales:leads", "content:review",
	"legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send",
	"finance:reports", "payments:webhooks", "payments:wallets",
	"settings:edit", "staff:manage",
	"audit:read", "audit:export",
}

var DepartmentRoleTemplates = []DepartmentRoleTemplate{
	{"support", "Support", "Support", []string{"users:read", "orders:read", "support:tickets", "support:chat", "support:email", "support:assign", "support:helpContent"}},
	{"marketing", "Marketing", "Marketing", []string{"metrics:read", "marketing:campaigns", "marketing:email", "catalog:manage"}},
	{"sales", "Sales", "Sales", []string{"metrics:read", "users:read", "sales:leads", "applications:sellers", "brands:review"}},
	{"finance", "Finance", "Finance", []string{"metrics:read", "orders:read", "payouts:approve", "refunds:issue", "coins:review", "ledger:read", "finance:reports", "audit:read", "payments:webhooks", "payments:wallets"}},
	{"trust", "Trust & Safety", "Trust & Safety", []string{"users:read", "users:moderate", "users:restrict", "users:suspend", "moderation:reports", "moderation:appeals", "chat-reports:review", "copyright:review", "ip-claims:review", "security:cases"}},
	{"verification", "Verification", "Verification", []string{"users:read", "verification:review", "verification:documents", "verification:grant", "applications:sellers", "applications:creators"}},
	{"content", "Content", "Content", []string{"content:review", "catalog:manage", "applications:creators", "moderation:reports"}},
	{"ads", "Ads", "Ads", []string{"ads:review", "advertisers:manage", "metrics:read"}},
	{"legal", "Legal", "Legal", []string{"legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send"}},
	{"engineering", "Engineering (read-only)", "Engineering", []string{"metrics:read", "users:read", "orders:read", "ledger:read", "config:read", "audit:read"}},
}

var permissionAliases = map[string][]string{
	"audit:read":                {"admin.audit.read"},
	"audit:export":              {"admin.audit.read"},
	"config:read":               {"admin.config.read", "privacy.retention.read", "money.monetization.read"},
	"config:rules":              {"admin.config.write", "privacy.retention.write"},
	"config:plans":              {"admin.config.write", "money.monetization.manage"},
	"settings:edit":             {"admin.config.write"},
	"staff:manage":              {"admin.staff.read"},
	"usernames:manage":          {"users.usernames.read", "users.usernames.withhold"},
	"reserved-usernames:manage": {"users.usernames.read", "users.usernames.reserve"},
	"legal.documents.publish":   {"privacy.policies.write"},
	"ledger:read":               {"money.ledger.read"},
	"payouts:approve":           {"money.withdrawals.read", "money.withdrawals.process"},
	"disputes:resolve":          {"money.disputes.resolve"},
	"coins:review":              {"money.coins.review"},
	"config:revenue":            {"money.monetization.manage"},
}

func IsKnownPermission(candidate string) bool {
	for _, key := range AllPermissionKeys {
		if key == candidate {
			return true
		}
	}
	return false
}

func ExpandPermissionsWithAliases(permissions []string) []string {
	seen := map[string]bool{}
	expanded := make([]string, 0, len(permissions)*2)
	add := func(permission string) {
		if !seen[permission] {
			seen[permission] = true
			expanded = append(expanded, permission)
		}
	}
	for _, permission := range permissions {
		add(permission)
		for _, alias := range permissionAliases[permission] {
			add(alias)
		}
	}
	return expanded
}

func IsGrantablePermission(candidate string) bool {
	if IsKnownPermission(candidate) {
		return true
	}
	for _, aliases := range permissionAliases {
		for _, alias := range aliases {
			if alias == candidate {
				return true
			}
		}
	}
	return false
}
