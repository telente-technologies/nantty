import { randomBytes } from "node:crypto";

import { invalidState } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { StaffAccountRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "../repositories/platformStaff.repository.js";
import { buildTotpProvisioningUri, findMatchingTotpTimeStep, generateTotpSecretInBase32 } from "./totp.service.js";

const RECOVERY_CODE_COUNT = 10;

export interface SecondFactorProof {
  readonly code?: string | undefined;
  readonly recoveryCode?: string | undefined;
}

export interface TotpEnrollment {
  readonly secret: string;
  readonly otpauthUri: string;
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

  public async beginTotpEnrollment(account: StaffAccountRecord, accountLabel: string): Promise<TotpEnrollment> {
    if (account.totpEnabledAt !== null) throw invalidState("Two-factor authentication is already set up for this account.");
    const secret = generateTotpSecretInBase32();
    await this.accounts.update(account.userId, { pendingTotpSecretEncrypted: await this.cipher.encryptText(secret) }, this.clock.now());
    return { secret, otpauthUri: buildTotpProvisioningUri(this.totpIssuer, accountLabel, secret) };
  }

  public async enableTotpImmediately(account: StaffAccountRecord, accountLabel: string): Promise<TotpEnrollment & { readonly recoveryCodes: readonly string[] }> {
    const secret = generateTotpSecretInBase32();
    const recoveryCodes = await this.storeTotpSecretAndRecoveryCodes(account.userId, secret, null);
    return { secret, otpauthUri: buildTotpProvisioningUri(this.totpIssuer, accountLabel, secret), recoveryCodes };
  }

  public async confirmPendingTotpEnrollment(account: StaffAccountRecord, code: string): Promise<readonly string[] | undefined> {
    if (account.pendingTotpSecretEncrypted === null) return undefined;
    const secret = await this.cipher.decryptText(account.pendingTotpSecretEncrypted);
    const matchedStep = findMatchingTotpTimeStep(secret, code, this.clock.now());
    if (matchedStep === undefined) return undefined;
    return this.storeTotpSecretAndRecoveryCodes(account.userId, secret, matchedStep);
  }

  public async verifySecondFactor(account: StaffAccountRecord, proof: SecondFactorProof): Promise<boolean> {
    if (account.totpSecretEncrypted === null || account.totpEnabledAt === null) return false;
    if (proof.code !== undefined) return this.verifyTotpCodeOnce(account, proof.code);
    if (proof.recoveryCode !== undefined) return this.consumeRecoveryCode(account, proof.recoveryCode);
    return false;
  }

  public async regenerateRecoveryCodes(account: StaffAccountRecord): Promise<readonly string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.accounts.update(account.userId, { recoveryCodeHashes: await this.hashRecoveryCodes(codes) }, this.clock.now());
    return codes;
  }

  public async resetTotp(userId: string): Promise<void> {
    await this.accounts.update(
      userId,
      { totpSecretEncrypted: null, pendingTotpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, recoveryCodeHashes: [] },
      this.clock.now(),
    );
  }

  private async storeTotpSecretAndRecoveryCodes(userId: string, secret: string, lastUsedStep: number | null): Promise<readonly string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.accounts.update(
      userId,
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

  private async verifyTotpCodeOnce(account: StaffAccountRecord, code: string): Promise<boolean> {
    const secret = await this.cipher.decryptText(account.totpSecretEncrypted as string);
    const matchedStep = findMatchingTotpTimeStep(secret, code, this.clock.now());
    if (matchedStep === undefined) return false;
    if (account.totpLastUsedStep !== null && matchedStep <= account.totpLastUsedStep) return false;
    await this.accounts.update(account.userId, { totpLastUsedStep: matchedStep }, this.clock.now());
    return true;
  }

  private async consumeRecoveryCode(account: StaffAccountRecord, recoveryCode: string): Promise<boolean> {
    const presentedHash = await hashSecretWithKey(normalizeRecoveryCode(recoveryCode), this.recoveryCodeHashKey);
    const remaining = account.recoveryCodeHashes.filter((storedHash) => !hashesAreEqual(storedHash, presentedHash));
    if (remaining.length === account.recoveryCodeHashes.length) return false;
    await this.accounts.update(account.userId, { recoveryCodeHashes: remaining }, this.clock.now());
    return true;
  }

  private hashRecoveryCodes(codes: readonly string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => hashSecretWithKey(normalizeRecoveryCode(code), this.recoveryCodeHashKey)));
  }
}
