export interface EngagementIntegritySignals {
  readonly engagerCount: number;
  readonly newAccountEngagerShare: number;
  readonly lowTrustEngagerShare: number;
  readonly suspendedEngagerShare: number;
  readonly clusteredEngagerShare: number;
  readonly reciprocalPodShare: number;
  readonly burstRatio: number;
  readonly purchasedEngagementSuspected: boolean;
  readonly spamHashtagCount: number;
}

export interface IntegrityAssessment {
  readonly trustedEngagementShare: number;
  readonly manipulated: boolean;
  readonly reasons: readonly string[];
}

export const cleanIntegritySignals: EngagementIntegritySignals = {
  engagerCount: 0, newAccountEngagerShare: 0, lowTrustEngagerShare: 0, suspendedEngagerShare: 0, clusteredEngagerShare: 0, reciprocalPodShare: 0, burstRatio: 0, purchasedEngagementSuspected: false, spamHashtagCount: 0,
};

const minimumEngagersForManipulationFlag = 10;

export function assessEngagementIntegrity(signals: EngagementIntegritySignals): IntegrityAssessment {
  const reasons: string[] = [];
  let excludedShare = Math.min(1, signals.suspendedEngagerShare + 0.75 * signals.newAccountEngagerShare + 0.75 * signals.lowTrustEngagerShare + 0.9 * signals.clusteredEngagerShare + 0.6 * signals.reciprocalPodShare);
  if (signals.newAccountEngagerShare >= 0.3) reasons.push("new_account_engagement");
  if (signals.suspendedEngagerShare >= 0.1) reasons.push("suspended_engagers");
  if (signals.clusteredEngagerShare >= 0.3) reasons.push("coordinated_cluster");
  if (signals.reciprocalPodShare >= 0.5) reasons.push("reciprocal_pod");
  if (signals.burstRatio >= 0.6) {
    reasons.push("engagement_burst");
    excludedShare = Math.min(1, excludedShare + 0.25 * signals.burstRatio);
  }
  if (signals.purchasedEngagementSuspected) {
    reasons.push("purchased_engagement");
    excludedShare = Math.max(excludedShare, 0.8);
  }
  if (signals.spamHashtagCount > 0) reasons.push("spam_hashtags");
  const spamPenalty = Math.min(signals.spamHashtagCount * 0.15, 0.6);
  const trustedEngagementShare = Math.max((1 - excludedShare) * (1 - spamPenalty), 0.05);
  const manipulated = signals.engagerCount >= minimumEngagersForManipulationFlag && (excludedShare >= 0.5 || signals.purchasedEngagementSuspected);
  return { trustedEngagementShare, manipulated, reasons };
}
