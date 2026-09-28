import { hashPassword, verifyPassword } from "@zudojs/auth";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../../constants/security.constant.js";
import { unprocessable } from "../../../errors/domain.error.js";

export class PasswordService {
  private placeholderHash: Promise<string> | undefined;

  public assertPasswordMeetsPolicy(password: string): void {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      throw unprocessable(`Passwords must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters long.`);
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw unprocessable("Passwords must contain at least one letter and one number.");
    }
  }

  public hashNewPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  public async verifyPasswordAgainstStoredHash(password: string, storedHash: string | null): Promise<boolean> {
    if (storedHash === null) {
      this.placeholderHash ??= hashPassword("placeholder-password-for-timing-1");
      await verifyPassword(password, await this.placeholderHash);
      return false;
    }
    return verifyPassword(password, storedHash);
  }
}
