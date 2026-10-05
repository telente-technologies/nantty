package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	ipallowlist "zudomart/modules/admin/src/utils/ipAllowList"
)

type StaffNetworkPolicy struct {
	Container *container.Container
}

func (policy StaffNetworkPolicy) IsStaffAddressAllowed(ctx context.Context, staffId, address string) (bool, error) {
	if !ipallowlist.IsAddressAllowed(address, policy.Container.Settings.IpAllowList) {
		return false, nil
	}
	identifier, err := uuid.Parse(staffId)
	if err != nil {
		return false, nil
	}
	staff, err := policy.Container.Client.StaffAccount.Query().Where(staffaccount.ID(identifier)).Select(staffaccount.FieldIPAllowList).Only(ctx)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return ipallowlist.IsAddressAllowed(address, staff.IPAllowList), nil
}
