import { MockHttpError, failValidation } from "@/mocks/mockResponses.mock";
import type { CreatorEligibilityRules, PlansConfiguration, RevenueRulesConfiguration, UsernameCharacterClass, UsernameRules, VerificationPlan } from "@/types/platformConfiguration.type";

import {
  readArrayAtPath, readBasisPoints, readBooleanValue, readCountryCodeList, readCurrencyCodeList, readEnumFromObject, readIntegerBetween, readMoneyPerCurrencyList, readObjectAtPath, readTextList, readTextValue,
} from "./configurationFieldReaders.mock";

function validatePlan(rawPlan: unknown, path: string, currentPlan: VerificationPlan): VerificationPlan {
  const plan = readObjectAtPath(rawPlan, path);
  const isBlackOfficial = currentPlan.color === "BLACK";
  const isPurchasable = isBlackOfficial ? false : readBooleanValue(plan, "isPurchasable", path);
  if (isBlackOfficial && plan.isPurchasable === true) throw new MockHttpError(400, "OFFICIAL_NOT_PURCHASABLE", "Black Official verification is never sold. It is granted only through the manual official process.");
  const entitlements = currentPlan.color === "GOLD"
    ? readArrayAtPath(plan.dashboardEntitlements, `${path}.dashboardEntitlements`, 30).map((rawEntitlement, index) => {
        const entitlement = readObjectAtPath(rawEntitlement, `${path}.dashboardEntitlements.${index}`);
        const limit = entitlement.limit === null ? null : readIntegerBetween(entitlement, "limit", `${path}.dashboardEntitlements.${index}`, 0, 1_000_000);
        return { key: readTextValue(entitlement, "key", `${path}.dashboardEntitlements.${index}`, 40, 2), label: readTextValue(entitlement, "label", `${path}.dashboardEntitlements.${index}`, 120, 2), limit };
      })
    : [];
  return {
    ...currentPlan,
    displayName: readTextValue(plan, "displayName", path, 40, 2),
    badgeVisible: currentPlan.tier === "ESSENTIAL" ? false : currentPlan.badgeVisible,
    isPurchasable,
    perks: readTextList(plan, "perks", path, 20, 120),
    dashboardEntitlements: entitlements,
  };
}

export function validatePlansConfiguration(rawContent: unknown, currentContent: PlansConfiguration | null): PlansConfiguration {
  if (!currentContent) failValidation("content", "Plans cannot be created from scratch.");
  const content = readObjectAtPath(rawContent, "content");
  const supportedCurrencies = readCurrencyCodeList(content, "supportedCurrencies", "content");
  const rawPlans = readArrayAtPath(content.plans, "content.plans", 20);
  const plans = currentContent.plans.map((currentPlan) => {
    const index = rawPlans.findIndex((rawPlan) => readObjectAtPath(rawPlan, "content.plans").planKey === currentPlan.planKey);
    if (index < 0) failValidation("content.plans", `Plan ${currentPlan.planKey} is missing. Plans can be edited, not removed.`);
    return validatePlan(rawPlans[index], `content.plans.${index}`, currentPlan);
  });
  return { supportedCurrencies, plans };
}

export function validateRevenueRules(rawContent: unknown, currentContent: RevenueRulesConfiguration | null): RevenueRulesConfiguration {
  if (!currentContent) failValidation("content", "Revenue rules cannot be created from scratch.");
  const content = readObjectAtPath(rawContent, "content");
  const supportedCurrencies = readCurrencyCodeList(content, "supportedCurrencies", "content");
  const ceiling = currentContent.giftCreatorShareCeilingBasisPoints;
  const escrowFee = readObjectAtPath(content.escrowFee, "content.escrowFee");
  const escrowFeeDefaultBasisPoints = readBasisPoints(escrowFee, "defaultBasisPoints", "content.escrowFee", 500);
  const escrowFeeBusinessBasisPoints = readBasisPoints(escrowFee, "businessPlanBasisPoints", "content.escrowFee", 500);
  if (escrowFeeBusinessBasisPoints > escrowFeeDefaultBasisPoints) failValidation("content.escrowFee.businessPlanBasisPoints", "The Business plan escrow fee can't be higher than the default.");
  const withdrawalFee = readObjectAtPath(content.withdrawalFee, "content.withdrawalFee");
  return {
    supportedCurrencies,
    creatorAdShareBasisPoints: readBasisPoints(content, "creatorAdShareBasisPoints", "content", 9000),
    giftCreatorShareBasisPoints: readBasisPoints(content, "giftCreatorShareBasisPoints", "content", ceiling),
    giftCreatorShareCeilingBasisPoints: ceiling,
    coinTransferFeeBasisPoints: readBasisPoints(content, "coinTransferFeeBasisPoints", "content", 5000),
    coinUnitValues: readMoneyPerCurrencyList(content, "coinUnitValues", "content", supportedCurrencies),
    withdrawalFee: { mode: readEnumFromObject(withdrawalFee, "mode", "content.withdrawalFee", ["PASS_THROUGH"] as const), note: readTextValue(withdrawalFee, "note", "content.withdrawalFee", 300, 5) },
    escrowFee: { defaultBasisPoints: escrowFeeDefaultBasisPoints, businessPlanBasisPoints: escrowFeeBusinessBasisPoints },
  };
}

export function validateCreatorEligibilityRules(rawContent: unknown): CreatorEligibilityRules {
  const content = readObjectAtPath(rawContent, "content");
  return {
    minimumFollowers: readIntegerBetween(content, "minimumFollowers", "content", 0, 10_000_000),
    minimumPostsInLast30Days: readIntegerBetween(content, "minimumPostsInLast30Days", "content", 0, 1000),
    maximumActiveStrikes: readIntegerBetween(content, "maximumActiveStrikes", "content", 0, 10),
    minimumAccountAgeDays: readIntegerBetween(content, "minimumAccountAgeDays", "content", 0, 3650),
    requiresIdentityVerification: readBooleanValue(content, "requiresIdentityVerification", "content"),
    allowedCountries: readCountryCodeList(content, "allowedCountries", "content"),
  };
}

const usernameCharacterClasses: readonly UsernameCharacterClass[] = ["LOWERCASE_LETTERS", "DIGITS", "DOT", "UNDERSCORE"];

export function validateUsernameRules(rawContent: unknown): UsernameRules {
  const content = readObjectAtPath(rawContent, "content");
  const minimumLength = readIntegerBetween(content, "minimumLength", "content", 1, 30);
  const maximumLength = readIntegerBetween(content, "maximumLength", "content", minimumLength, 50);
  const allowedCharacterClasses = readTextList(content, "allowedCharacterClasses", "content", 4, 20).map((characterClass, index) => {
    if (!(usernameCharacterClasses as readonly string[]).includes(characterClass)) failValidation(`content.allowedCharacterClasses.${index}`, `Unknown character class ${characterClass}.`);
    return characterClass as UsernameCharacterClass;
  });
  if (!allowedCharacterClasses.includes("LOWERCASE_LETTERS")) failValidation("content.allowedCharacterClasses", "Usernames must allow letters.");
  return {
    changesAllowedPerWindow: readIntegerBetween(content, "changesAllowedPerWindow", "content", 0, 10),
    changeWindowDays: readIntegerBetween(content, "changeWindowDays", "content", 1, 365),
    minimumLength,
    maximumLength,
    allowedCharacterClasses,
    mustStartWithLetter: readBooleanValue(content, "mustStartWithLetter", "content"),
    releasedUsernameCooldownDays: readIntegerBetween(content, "releasedUsernameCooldownDays", "content", 0, 365),
  };
}
