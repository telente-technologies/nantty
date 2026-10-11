import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { buildInitialConfigurationDocuments } from "@/mocks/seed/configurationDocuments.mock";
import { buildInitialAutomationRules } from "@/mocks/seed/configurationAutomation.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import type { AutomationRuleContent } from "@/types/automation.type";
import type { ConfigurationDocumentContentByKey, CreatorEligibilityRules, PlansConfiguration, RevenueRulesConfiguration } from "@/types/platformConfiguration.type";

import { validateCheckmarkPricing, validateCheckmarkSuggestionRules, validateCreatorThresholds, validateTrialRules } from "./configurationTrustRulesValidation.mock";
import { validateCreatorEligibilityRules, validatePlansConfiguration, validateRevenueRules, validateUsernameRules } from "./configurationDocumentValidation.mock";
import { validateAutomationRuleContent } from "./configurationEntityValidation.mock";
import { validateAppStoreFees } from "./appStoreFeesValidation.mock";
import { validatePaymentLimits, validateSellerDebtLimits } from "./moneyLimitsValidation.mock";
import { validateFeedRankingPolicy } from "./rankingSettingsValidation.mock";
import { validateRegionalPricingDocument } from "./regionalPricingValidation.mock";
import type { VersionedCollectionDefinition } from "./versionedCollections.mock";

type AnyDocumentContent = ConfigurationDocumentContentByKey[keyof ConfigurationDocumentContentByKey];

const writePermissionByDocumentKey: Record<string, AdminPermission> = { plans: "config:plans", revenue: "config:revenue", "creator-eligibility": "config:rules", "username-rules": "config:rules", "checkmark-suggestions": "config:rules", "creator-thresholds": "config:rules", "trial-rules": "config:rules", "checkmark-pricing": "config:plans", "regional-pricing": "config:revenue", "feed.ranking": "config:rules", "appStore.fees": "config:revenue", "seller.debtLimits": "config:revenue", "payments.limits": "config:revenue" };
const documentLabels: Record<string, string> = { plans: "Plans & prices", revenue: "Revenue rules", "creator-eligibility": "Creator eligibility rules", "username-rules": "Username rules", "checkmark-suggestions": "Checkmark suggestion thresholds", "creator-thresholds": "Creator Program thresholds", "trial-rules": "Trial rules", "checkmark-pricing": "Checkmark pricing", "regional-pricing": "Regional ad floors and creator bands", "feed.ranking": "Feed ranking boosts", "appStore.fees": "App store fees", "seller.debtLimits": "Seller debt limits", "payments.limits": "Payment limits" };

export const configurationDocumentsDefinition: VersionedCollectionDefinition<AnyDocumentContent> = {
  storeName: "documents",
  basePath: "/admin/config",
  readPermissions: ["config:read", "config:plans", "config:revenue", "config:rules"],
  readWritePermissionForRecord: (recordId) => writePermissionByDocumentKey[recordId] ?? "config:plans",
  auditActionPrefix: "config.document",
  auditTargetType: "configDocument",
  describeRecordForAudit: (recordId) => documentLabels[recordId] ?? recordId,
  createInitialRecords: buildInitialConfigurationDocuments,
  validateIncomingContent: (rawContent, recordId, currentContent) => {
    if (recordId === "plans") return validatePlansConfiguration(rawContent, currentContent as PlansConfiguration | null);
    if (recordId === "revenue") return validateRevenueRules(rawContent, currentContent as RevenueRulesConfiguration | null);
    if (recordId === "creator-eligibility") return validateCreatorEligibilityRules(rawContent) satisfies CreatorEligibilityRules;
    if (recordId === "username-rules") return validateUsernameRules(rawContent);
    if (recordId === "checkmark-suggestions") return validateCheckmarkSuggestionRules(rawContent);
    if (recordId === "creator-thresholds") return validateCreatorThresholds(rawContent);
    if (recordId === "trial-rules") return validateTrialRules(rawContent);
    if (recordId === "checkmark-pricing") return validateCheckmarkPricing(rawContent);
    if (recordId === "regional-pricing") return validateRegionalPricingDocument(rawContent);
    if (recordId === "feed.ranking") return validateFeedRankingPolicy(rawContent);
    if (recordId === "appStore.fees") return validateAppStoreFees(rawContent);
    if (recordId === "seller.debtLimits") return validateSellerDebtLimits(rawContent);
    if (recordId === "payments.limits") return validatePaymentLimits(rawContent);
    failNotFound("Configuration document");
  },
  isValidNewRecordId: () => false,
  canCreate: false,
  canArchive: false,
};

export const automationRulesDefinition: VersionedCollectionDefinition<AutomationRuleContent> = {
  storeName: "automationRules",
  basePath: "/admin/automation/rules",
  readPermissions: ["automation:manage"],
  readWritePermissionForRecord: () => "automation:manage",
  auditActionPrefix: "config.automation_rule",
  auditTargetType: "automationRule",
  describeRecordForAudit: (recordId, content) => content.name || recordId,
  createInitialRecords: buildInitialAutomationRules,
  validateIncomingContent: (rawContent) => validateAutomationRuleContent(rawContent),
  isValidNewRecordId: (recordId) => /^rule_[a-z0-9_]{3,58}$/.test(recordId),
  canCreate: true,
  canArchive: true,
};
