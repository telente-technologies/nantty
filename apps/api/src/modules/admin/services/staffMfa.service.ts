import { randomBytes } from "node:crypto";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { StaffAccountRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "../repositories/staffAccounts.repository.js";
import { buildTotpProvisioningUri, findMatchingTotpTimeStep, generateTotpSecretInBase32 } from "./totp.service.js";

export const RECOVERY_CODE_COUNT = 8;

export interface TotpEnrollment {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly issuer: string;
  readonly accountName: string;
}

function generateRecoveryCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export class StaffMfaService {
  public constructor(
    private readonly accounts: StaffAccountsRepository,
    private readonly cipher: FieldCipher,
    private readonly recoveryCodeHashKey: Uint8Array,
    private readonly clock: Clock,
    private readonly totpIssuer: string,
  ) {}

  public describeEnrollment(account: StaffAccountRecord, secret: string): TotpEnrollment {
    return { secret, otpauthUri: buildTotpProvisioningUri(this.totpIssuer, account.email, secret), issuer: this.totpIssuer, accountName: account.email };
  }

  public async beginTotpEnrollment(account: StaffAccountRecord): Promise<TotpEnrollment> {
    const secret = generateTotpSecretInBase32();
    await this.accounts.update(account.id, { pendingTotpSecretEncrypted: await this.cipher.encryptText(secret) }, this.clock.now());
    return this.describeEnrollment(account, secret);
  }

  public async enableTotpImmediately(account: StaffAccountRecord): Promise<TotpEnrollment & { readonly recoveryCodes: readonly string[] }> {
    const secret = generateTotpSecretInBase32();
    const recoveryCodes = await this.storeTotpSecretAndRecoveryCodes(account.id, secret, null);
    return { ...this.describeEnrollment(account, secret), recoveryCodes };
  }

  public async confirmPendingTotpEnrollment(account: StaffAccountRecord, code: string): Promise<readonly string[] | undefined> {
    if (account.pendingTotpSecretEncrypted === null) return undefined;
    const secret = await this.cipher.decryptText(account.pendingTotpSecretEncrypted);
    const matchedStep = findMatchingTotpTimeStep(secret, code, this.clock.now());
    if (matchedStep === undefined) return undefined;
    return this.storeTotpSecretAndRecoveryCodes(account.id, secret, matchedStep);
  }

  public async verifyTotpCodeOnce(account: StaffAccountRecord, code: string): Promise<boolean> {
    if (account.totpSecretEncrypted === null || account.totpEnabledAt === null) return false;
    const secret = await this.cipher.decryptText(account.totpSecretEncrypted);
    const matchedStep = findMatchingTotpTimeStep(secret, code, this.clock.now());
    if (matchedStep === undefined) return false;
    if (account.totpLastUsedStep !== null && matchedStep <= account.totpLastUsedStep) return false;
    await this.accounts.update(account.id, { totpLastUsedStep: matchedStep }, this.clock.now());
    return true;
  }

  public async consumeRecoveryCode(account: StaffAccountRecord, recoveryCode: string): Promise<boolean> {
    if (account.totpEnabledAt === null) return false;
    const presentedHash = await hashSecretWithKey(normalizeRecoveryCode(recoveryCode), this.recoveryCodeHashKey);
    const remaining = account.recoveryCodeHashes.filter((storedHash) => !hashesAreEqual(storedHash, presentedHash));
    if (remaining.length === account.recoveryCodeHashes.length) return false;
    await this.accounts.update(account.id, { recoveryCodeHashes: remaining }, this.clock.now());
    return true;
  }

  public async regenerateRecoveryCodes(account: StaffAccountRecord): Promise<readonly string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.accounts.update(account.id, { recoveryCodeHashes: await this.hashRecoveryCodes(codes) }, this.clock.now());
    return codes;
  }

  public async removeAllSecondFactors(staffId: string): Promise<void> {
    await this.accounts.update(
      staffId,
      { totpSecretEncrypted: null, pendingTotpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, recoveryCodeHashes: [] },
      this.clock.now(),
    );
  }

  private async storeTotpSecretAndRecoveryCodes(staffId: string, secret: string, lastUsedStep: number | null): Promise<readonly string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.accounts.update(
      staffId,
      {
        totpSecretEncrypted: await this.cipher.encryptText(secret),
        pendingTotpSecretEncrypted: null,
        totpEnabledAt: this.clock.now(),
        totpLastUsedStep: lastUsedStep,
        recoveryCodeHashes: await this.hashRecoveryCodes(codes),
      },
      this.clock.now(),
    );
    return codes;
  }

  private hashRecoveryCodes(codes: readonly string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => hashSecretWithKey(normalizeRecoveryCode(code), this.recoveryCodeHashKey)));
  }
}
