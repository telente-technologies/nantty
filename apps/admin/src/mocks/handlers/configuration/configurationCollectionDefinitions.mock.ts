import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { buildInitialConfigurationDocuments } from "@/mocks/seed/configurationDocuments.mock";
import { buildInitialAutomationRules } from "@/mocks/seed/configurationAutomation.mock";
import { buildInitialExperiments, buildInitialFeatureFlags } from "@/mocks/seed/configurationFlagsAndExperiments.mock";
import { buildInitialNotificationTemplates } from "@/mocks/seed/configurationTemplates.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import type { AutomationRuleContent } from "@/types/automation.type";
import type { ExperimentContent, FeatureFlagContent } from "@/types/featureFlags.type";
import type { NotificationTemplateContent } from "@/types/notificationTemplate.type";
import type { ConfigurationDocumentContentByKey, CreatorEligibilityRules, PlansConfiguration, RevenueRulesConfiguration } from "@/types/platformConfiguration.type";

import { validateCheckmarkPricing, validateCheckmarkSuggestionRules, validateCreatorThresholds, validateTrialRules } from "./configurationTrustRulesValidation.mock";
import { validateCreatorEligibilityRules, validatePlansConfiguration, validateRevenueRules, validateUsernameRules } from "./configurationDocumentValidation.mock";
import { configurationRecordIdPattern, validateAutomationRuleContent, validateExperimentContent, validateFeatureFlagContent, validateNotificationTemplateContent } from "./configurationEntityValidation.mock";
import { validateRegionalPricingDocument } from "./regionalPricingValidation.mock";
import type { VersionedCollectionDefinition } from "./versionedCollections.mock";

type AnyDocumentContent = ConfigurationDocumentContentByKey[keyof ConfigurationDocumentContentByKey];

const writePermissionByDocumentKey: Record<string, AdminPermission> = { plans: "config:plans", revenue: "config:revenue", "creator-eligibility": "config:rules", "username-rules": "config:rules", "checkmark-suggestions": "config:rules", "creator-thresholds": "config:rules", "trial-rules": "config:rules", "checkmark-pricing": "config:plans", "regional-pricing": "config:revenue" };
const documentLabels: Record<string, string> = { plans: "Plans & prices", revenue: "Revenue rules", "creator-eligibility": "Creator eligibility rules", "username-rules": "Username rules", "checkmark-suggestions": "Checkmark suggestion thresholds", "creator-thresholds": "Creator Program thresholds", "trial-rules": "Trial rules", "checkmark-pricing": "Checkmark pricing", "regional-pricing": "Regional ad floors and creator bands" };

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
    failNotFound("Configuration document");
  },
  isValidNewRecordId: () => false,
  canCreate: false,
  canArchive: false,
};

export const featureFlagsDefinition: VersionedCollectionDefinition<FeatureFlagContent> = {
  storeName: "flags",
  basePath: "/admin/flags",
  readPermissions: ["flags:manage", "config:read"],
  readWritePermissionForRecord: () => "flags:manage",
  auditActionPrefix: "config.flag",
  auditTargetType: "featureFlag",
  describeRecordForAudit: (recordId) => `Flag ${recordId}`,
  createInitialRecords: buildInitialFeatureFlags,
  validateIncomingContent: (rawContent) => validateFeatureFlagContent(rawContent),
  isValidNewRecordId: (recordId) => configurationRecordIdPattern.test(recordId),
  canCreate: true,
  canArchive: true,
};

export const experimentsDefinition: VersionedCollectionDefinition<ExperimentContent> = {
  storeName: "experiments",
  basePath: "/admin/experiments",
  readPermissions: ["flags:manage", "config:read"],
  readWritePermissionForRecord: () => "flags:manage",
  auditActionPrefix: "config.experiment",
  auditTargetType: "experiment",
  describeRecordForAudit: (recordId, content) => `Experiment ${content.name || recordId}`,
  createInitialRecords: buildInitialExperiments,
  validateIncomingContent: (rawContent, _recordId, currentContent) => validateExperimentContent(rawContent, currentContent),
  isValidNewRecordId: (recordId) => configurationRecordIdPattern.test(recordId),
  canCreate: true,
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

export const notificationTemplatesDefinition: VersionedCollectionDefinition<NotificationTemplateContent> = {
  storeName: "notificationTemplates",
  basePath: "/admin/notification-templates",
  readPermissions: ["templates:manage", "config:read"],
  readWritePermissionForRecord: () => "templates:manage",
  auditActionPrefix: "config.notification_template",
  auditTargetType: "notificationTemplate",
  describeRecordForAudit: (recordId) => `Template ${recordId}`,
  createInitialRecords: buildInitialNotificationTemplates,
  validateIncomingContent: (rawContent, recordId, currentContent) => validateNotificationTemplateContent(rawContent, recordId, currentContent),
  isValidNewRecordId: (recordId) => /^[a-z][a-z_.]+\.(push|email|sms|in_app)\.(en|fr|pcm)$/.test(recordId),
  canCreate: true,
  canArchive: false,
};
