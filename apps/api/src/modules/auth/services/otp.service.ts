import { randomNumericCode } from "@zudojs/crypto";
import { TooManyRequestsError } from "@zudojs/errors";

import type { AppSettings } from "../../../configs/settings.config.js";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "../../../constants/security.constant.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { OtpPurpose } from "../models/auth.model.js";
import type { OneTimeCodesRepository } from "../repositories/auth.repository.js";
import type { ContactAddress } from "./contact.service.js";

export interface OneTimeCodeDelivery {
  deliverOneTimeCode(contact: ContactAddress, code: string, purpose: OtpPurpose): Promise<void>;
}

export class OtpService {
  private readonly codeHashKey: Uint8Array;

  public constructor(
    private readonly codes: OneTimeCodesRepository,
    private readonly delivery: OneTimeCodeDelivery,
    private readonly settings: AppSettings["auth"],
    private readonly clock: Clock,
    dataEncryptionKey: Uint8Array,
  ) {
    this.codeHashKey = new Uint8Array([...dataEncryptionKey, ...new TextEncoder().encode("otp")]);
  }

  public async sendOneTimeCode(contact: ContactAddress, purpose: OtpPurpose): Promise<void> {
    const now = this.clock.now();
    const latest = await this.codes.findLatestCode(contact.value, purpose);
    if (latest !== undefined && now.getTime() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) return;
    const code = await randomNumericCode(OTP_LENGTH);
    const expiresAt = new Date(now.getTime() + this.settings.otpTtlSeconds * 1000);
    await this.codes.replaceActiveCode(contact.value, purpose, await this.hashOneTimeCode(contact.value, purpose, code), expiresAt, now);
    await this.delivery.deliverOneTimeCode(contact, code, purpose);
  }

  public async verifyAndConsumeOneTimeCode(contact: ContactAddress, purpose: OtpPurpose, code: string): Promise<boolean> {
    const now = this.clock.now();
    const record = await this.codes.findLatestActiveCode(contact.value, purpose, now);
    if (record === undefined) return false;
    if (record.attempts >= this.settings.otpMaxAttempts) {
      throw new TooManyRequestsError("Too many incorrect attempts. Request a new code.");
    }
    const expectedHash = await this.hashOneTimeCode(contact.value, purpose, code);
    if (!hashesAreEqual(expectedHash, record.codeHash)) {
      const attempts = await this.codes.incrementFailedAttempts(record.id);
      if (attempts >= this.settings.otpMaxAttempts) await this.codes.consumeCode(record.id, now);
      return false;
    }
    return this.codes.consumeCode(record.id, now);
  }

  private hashOneTimeCode(target: string, purpose: OtpPurpose, code: string): Promise<string> {
    return hashSecretWithKey(`${purpose}:${target}:${code}`, this.codeHashKey);
  }
}
