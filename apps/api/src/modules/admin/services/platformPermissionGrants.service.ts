import { ADMIN_PERMISSIONS, type Permission } from "../../../constants/permissions.constant.js";
import { platformRoleGrantsPermission } from "../../../constants/platformRoles.constant.js";
import type { PlatformPermissionGrants } from "../../../interfaces/platformStaffAccess.interface.js";
import type { StaffAccountsRepository } from "../repositories/platformStaff.repository.js";

export class RepositoryPlatformPermissionGrants implements PlatformPermissionGrants {
  public constructor(private readonly accounts: StaffAccountsRepository) {}

  public async findGrantedPlatformPermissions(userId: string): Promise<readonly Permission[]> {
    const account = await this.accounts.findByUserId(userId);
    if (account === undefined || account.status !== "active") return [];
    return ADMIN_PERMISSIONS.filter((permission) => platformRoleGrantsPermission(account.role, account.permissions, permission));
  }
}
