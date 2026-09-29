import { buildAccountApiPath, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { Page } from "@/types/api.type";
import type { AutomatedRule, AutomatedRuleInput, ConversionEvent, ConversionEventInput, Experiment, ExperimentInput } from "@/types/tools.type";

export const toolsApi = {
  listConversionEvents: (accountId: string) => sendAdsApiRequest<Page<ConversionEvent>>(buildAccountApiPath(accountId, "/conversion-events")),
  createConversionEvent: (accountId: string, input: ConversionEventInput) =>
    sendAdsApiRequest<ConversionEvent>(buildAccountApiPath(accountId, "/conversion-events"), { method: "POST", body: input }),
  updateConversionEvent: (accountId: string, eventId: string, changes: { name?: string; status?: "active" | "paused" }) =>
    sendAdsApiRequest<ConversionEvent>(buildAccountApiPath(accountId, `/conversion-events/${encodeURIComponent(eventId)}`), { method: "PATCH", body: changes }),
  listExperiments: (accountId: string) => sendAdsApiRequest<Page<Experiment>>(buildAccountApiPath(accountId, "/experiments")),
  createExperiment: (accountId: string, input: ExperimentInput) => sendAdsApiRequest<Experiment>(buildAccountApiPath(accountId, "/experiments"), { method: "POST", body: input }),
  stopExperiment: (accountId: string, experimentId: string) =>
    sendAdsApiRequest<Experiment>(buildAccountApiPath(accountId, `/experiments/${encodeURIComponent(experimentId)}/stop`), { method: "POST" }),
  listRules: (accountId: string) => sendAdsApiRequest<Page<AutomatedRule>>(buildAccountApiPath(accountId, "/rules")),
  createRule: (accountId: string, input: AutomatedRuleInput) => sendAdsApiRequest<AutomatedRule>(buildAccountApiPath(accountId, "/rules"), { method: "POST", body: input }),
  updateRule: (accountId: string, ruleId: string, changes: Partial<AutomatedRuleInput> & { status?: "active" | "paused" }) =>
    sendAdsApiRequest<AutomatedRule>(buildAccountApiPath(accountId, `/rules/${encodeURIComponent(ruleId)}`), { method: "PATCH", body: changes }),
  deleteRule: (accountId: string, ruleId: string) => sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/rules/${encodeURIComponent(ruleId)}`), { method: "DELETE" }),
};
