package identitytest

import (
	"context"

	"zudomart/platform/identityports"
)

type ActiveStaffSessionChecker struct{}

func (ActiveStaffSessionChecker) IsStaffSessionActive(_ context.Context, _, _ string) (bool, error) {
	return true, nil
}

var _ identityports.StaffSessionChecker = ActiveStaffSessionChecker{}

type PermissiveStaffNetworkPolicy struct{}

func (PermissiveStaffNetworkPolicy) IsStaffAddressAllowed(_ context.Context, _, _ string) (bool, error) {
	return true, nil
}

var _ identityports.StaffNetworkPolicy = PermissiveStaffNetworkPolicy{}
