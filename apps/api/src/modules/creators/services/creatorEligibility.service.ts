import type { CreatorEligibility, EligibilityCriterion } from "../models/creators.model.js";
import type { CreatorsDependencies } from "./creators.service.js";

const DAY_MILLISECONDS = 86_400_000;

export class CreatorEligibilityService {
  public constructor(private readonly dependencies: CreatorsDependencies) {}

  public async evaluateEligibility(userId: string): Promise<CreatorEligibility> {
    const { userDirectory, verification, socialGraph, postsService, program, settings, clock } = this.dependencies;
    const now = clock.now();
    const [standing, blueTier, followers, content, violations, profile] = await Promise.all([
      userDirectory.findUserAccountStanding(userId),
      verification.findPublicBlueTier(userId),
      socialGraph.countFollowers("user", userId),
      postsService.dependencies.posts.summarizeAuthorContent(userId),
      program.countViolationsSince(userId, new Date(now.getTime() - settings.violationLookbackDays * DAY_MILLISECONDS)),
      program.findProfile(userId),
    ]);
    const accountAgeDays = standing === undefined ? 0 : Math.max(0, Math.floor((now.getTime() - standing.createdAt.getTime()) / DAY_MILLISECONDS));
    const emailVerified = standing?.emailVerified ?? false;
    const inGoodStanding = violations === 0 && profile?.status !== "suspended" && (standing?.active ?? false);
    const criteria: Record<string, EligibilityCriterion> = {
      accountAge: { met: accountAgeDays >= settings.minimumAccountAgeDays, current: accountAgeDays, required: settings.minimumAccountAgeDays },
      verifiedEmail: { met: !settings.requireVerifiedEmail || emailVerified, current: emailVerified, required: settings.requireVerifiedEmail },
      goodStanding: { met: inGoodStanding, current: violations, required: 0 },
      blueVerification: { met: settings.requiredBlueTiers.length === 0 || (blueTier !== null && settings.requiredBlueTiers.includes(blueTier)), current: blueTier, required: settings.requiredBlueTiers },
      followers: { met: followers >= settings.minimumFollowers, current: followers, required: settings.minimumFollowers },
      posts: { met: content.postCount >= settings.minimumPosts, current: content.postCount, required: settings.minimumPosts },
    };
    return { eligible: Object.values(criteria).every((criterion) => criterion.met), criteria };
  }
}

export function listUnmetCriteria(eligibility: CreatorEligibility): readonly string[] {
  return Object.entries(eligibility.criteria).filter(([, criterion]) => !criterion.met).map(([name]) => name);
}
