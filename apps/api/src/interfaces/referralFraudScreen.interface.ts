export interface ReferralFraudCheck {
  readonly referrerId: string;
  readonly refereeId: string;
  readonly refereeAccountCreatedAt: Date | null;
  readonly referrerReferralsInLastDay: number;
}

export interface ReferralFraudVerdict {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface ReferralFraudScreen {
  screenReferral(check: ReferralFraudCheck): Promise<ReferralFraudVerdict>;
}
