package commerceports

import "slices"

var allSellerPermissions = []string{
	"dashboard:view", "catalog:view", "products:manage", "inventory:manage", "orders:view", "orders:manage",
	"delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage", "analytics:view",
	"promotions:manage", "ads:view", "affiliates:manage", "storefront:manage", "wallet:view", "wallet:withdraw",
	"reports:view", "staff:manage", "audit:view", "settings:view", "settings:manage", "billing:manage",
	"developer:manage", "media:upload",
}

var ownerOnlyPermissions = []string{"billing:manage", "wallet:withdraw", "developer:manage"}
var permissionsGrantedToEveryRole = []string{"dashboard:view", "catalog:view", "settings:view"}

func PermissionsForRole(role string) []string {
	switch role {
	case "owner":
		return allSellerPermissions
	case "manager":
		return slices.DeleteFunc(slices.Clone(allSellerPermissions), func(permission string) bool { return slices.Contains(ownerOnlyPermissions, permission) })
	case "inventory":
		return append(slices.Clone(permissionsGrantedToEveryRole), "products:manage", "inventory:manage", "media:upload")
	case "sales":
		return append(slices.Clone(permissionsGrantedToEveryRole), "orders:view", "orders:manage", "delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage")
	case "accountant":
		return append(slices.Clone(permissionsGrantedToEveryRole), "orders:view", "wallet:view", "reports:view", "analytics:view", "ads:view", "audit:view")
	}
	return nil
}

func RoleAllows(role string, customPermissions []string, permission string) bool {
	if role == "owner" {
		return true
	}
	if customPermissions != nil {
		return slices.Contains(customPermissions, permission)
	}
	return slices.Contains(PermissionsForRole(role), permission)
}

func IsKnownSellerPermission(permission string) bool {
	return slices.Contains(allSellerPermissions, permission)
}

func IsOwnerOnlyPermission(permission string) bool {
	return slices.Contains(ownerOnlyPermissions, permission)
}
