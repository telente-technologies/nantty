import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { failConflict, failNotFound, failValidation, matchesSearchText, paginateItems, readEnumValue, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { LiveIncidentAction, LiveIncidentDetail, LiveIncidentFrame, LiveIncidentSummary } from "@/types/liveIncident.type";

type MockIncident = Omit<LiveIncidentDetail, "history">;

const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const allowedSuspensionDays = [1, 3, 7, 30];

const frame = (id: string, minutesAgo: number, category: string | null, confidence: number, actionTaken = "none"): LiveIncidentFrame => ({
  id, frameRef: `live-safety/frames/${id}.jpeg`, previewUrl: null, restricted: false, capturedAt: readIsoTimeOffset(-minutesAgo), actionTaken, modelVersion: "aws-rekognition-moderation-7.0", confidence,
  labels: category ? [{ name: category === "weapon_threat" ? "Weapon Violence" : "Explicit Nudity", parentName: category === "weapon_threat" ? "Graphic Violence" : "Explicit", confidence }] : [],
  categories: category ? [{ category, confidence }] : [],
});

const incidents: MockIncident[] = [
  {
    id: "lsi_held_1", liveId: "live_9f2c", host: { id: "usr_204", username: "nightowl.beauty", displayName: "Night Owl Beauty", avatarUrl: null }, status: "open", priority: "urgent",
    holdActive: true, holdCategory: "sexual_explicit", holdSource: "automated", holdStartedAt: readIsoTimeOffset(-4), holdReason: "We paused your live because it may show nudity or sexual content.",
    topCategory: "sexual_explicit", topConfidence: 0.97, reportCount: 3, warningCount: 1, hashMatch: false, appealed: true, appealedAt: readIsoTimeOffset(-2), appealMessage: "It was a skin-tone swatch close-up, not nudity.",
    liveEnded: false, resolution: "", slaDueAt: readIsoTimeOffset(11), createdAt: readIsoTimeOffset(-6), updatedAt: readIsoTimeOffset(-2), latestFrameUrl: null,
    latestFrames: [frame("f_103", 0, null, 0), frame("f_102", 1, "sexual_explicit", 0.97, "hold"), frame("f_101", 2, "sexual_suggestive", 0.62, "review")],
    flaggedFrames: [frame("f_102", 1, "sexual_explicit", 0.97, "hold"), frame("f_101", 2, "sexual_suggestive", 0.62, "review")],
    transcripts: [], reports: [
      { id: "lsr_1", reason: "sexual_content", details: "", offsetSeconds: 612, frameRef: "live-safety/frames/f_101.jpeg", reporterId: "usr_88", createdAt: readIsoTimeOffset(-5) },
      { id: "lsr_2", reason: "sexual_content", details: "Host is flashing the camera", offsetSeconds: 640, frameRef: "", reporterId: "usr_91", createdAt: readIsoTimeOffset(-5) },
    ],
    decision: null,
  },
  {
    id: "lsi_reports_2", liveId: "live_77ab", host: { id: "usr_311", username: "lagos.flips", displayName: "Lagos Flips", avatarUrl: null }, status: "open", priority: "urgent",
    holdActive: false, holdCategory: "", holdSource: "", holdStartedAt: null, holdReason: "", topCategory: "weapon_threat", topConfidence: 0.78, reportCount: 6, warningCount: 1, hashMatch: false,
    appealed: false, appealedAt: null, appealMessage: "", liveEnded: false, resolution: "", slaDueAt: readIsoTimeOffset(9), createdAt: readIsoTimeOffset(-3), updatedAt: readIsoTimeOffset(-1), latestFrameUrl: null,
    latestFrames: [frame("f_201", 0, "weapon_threat", 0.78, "warn")], flaggedFrames: [frame("f_201", 0, "weapon_threat", 0.78, "warn")],
    transcripts: [{ id: "lst_1", snippet: "if he shows up here again I swear", categories: [{ category: "violent_speech", confidence: 0.64 }], confidence: 0.64, createdAt: readIsoTimeOffset(-1) }],
    reports: [{ id: "lsr_3", reason: "violence", details: "He is waving a knife at someone off camera", offsetSeconds: 1310, frameRef: "", reporterId: "usr_12", createdAt: readIsoTimeOffset(-2) }],
    decision: null,
  },
];

function presentSummary(incident: MockIncident): LiveIncidentSummary {
  const { holdReason, appealedAt, appealMessage, latestFrames, flaggedFrames, transcripts, reports, decision, ...summary } = incident;
  return summary;
}

function presentDetail(incident: MockIncident): LiveIncidentDetail {
  return { ...incident, history: listMockAuditEntriesForTarget("live_safety_incident", incident.id) };
}

function findOpenIncidentOrFail(request: MockRequest): MockIncident {
  const incident = incidents.find((candidate) => candidate.id === request.params.incidentId) ?? failNotFound("Live incident");
  if (incident.status !== "open") failConflict("INCIDENT_ALREADY_CLOSED", "Someone already closed this incident. Reload to see the outcome.");
  return incident;
}

function applyDecision(request: MockRequest, incident: MockIncident, action: LiveIncidentAction, reason: string, suspensionDays: number | null): LiveIncidentDetail {
  const before = { status: incident.status, holdActive: incident.holdActive };
  const closes = action !== "keep_paused";
  const holdActive = action === "keep_live" ? false : action === "keep_paused" ? true : incident.holdActive;
  Object.assign(incident, {
    holdActive, status: closes ? "closed" : "open", priority: closes ? incident.priority : "normal", resolution: action, liveEnded: action === "end_live" || action === "end_and_suspend" ? true : incident.liveEnded,
    decision: { action, reason, decidedByName: request.principal?.name ?? "System", decidedAt: readIsoNow(), suspensionDays }, updatedAt: readIsoNow(),
  });
  recordMockAuditEntry(request, { action: `liveIncident.${action}`, area: "moderation", target: { type: "live_safety_incident", id: incident.id, label: `live ${incident.liveId}` }, reason, before, after: { status: incident.status, holdActive: incident.holdActive } });
  return presentDetail(incident);
}

export function registerLiveIncidentMockHandlers(): void {
  registerMockRoute("GET", "/admin/live-incidents", (request) => {
    requireMockPermission(request, "moderation:reports");
    const status = request.query.get("status") ?? "open";
    const priority = request.query.get("priority");
    const search = request.query.get("search");
    const rows = incidents
      .filter((incident) => (status === "all" || incident.status === status) && (!priority || incident.priority === priority) && matchesSearchText(search, incident.liveId, incident.id))
      .sort((first, second) => priorityRank[first.priority] - priorityRank[second.priority] || Number(second.holdActive) - Number(first.holdActive) || first.slaDueAt.localeCompare(second.slaDueAt))
      .map(presentSummary);
    return respondWithJson(200, paginateItems(rows, request));
  });
  registerMockRoute("GET", "/admin/live-incidents/:incidentId", (request) => {
    requireMockPermission(request, "moderation:reports");
    return respondWithJson(200, presentDetail(incidents.find((incident) => incident.id === request.params.incidentId) ?? failNotFound("Live incident")));
  });
  registerMockRoute("POST", "/admin/live-incidents/:incidentId/actions", (request) => {
    requireMockPermission(request, "moderation:reports");
    const body = readJsonObjectBody(request);
    const action = readEnumValue(body, "action", ["keep_live", "keep_paused", "end_live"] as const);
    return respondWithJson(200, applyDecision(request, findOpenIncidentOrFail(request), action, readRequiredReason(body), null));
  });
  registerMockRoute("POST", "/admin/live-incidents/:incidentId/end-and-suspend", (request) => {
    requireMockPermission(request, "moderation:reports");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const durationDays = Number(body.durationDays);
    if (!allowedSuspensionDays.includes(durationDays)) failValidation("durationDays", "Choose 1, 3, 7 or 30 days.");
    return respondWithJson(200, applyDecision(request, findOpenIncidentOrFail(request), "end_and_suspend", readRequiredReason(body), durationDays));
  });
  registerMockQueueCounter({
    key: "liveIncidents", label: "Live incidents", href: "/moderation/live-incidents",
    readCount: () => {
      const open = incidents.filter((incident) => incident.status === "open");
      return { count: open.length, oldestAt: [...open.map((incident) => incident.createdAt)].sort()[0] ?? null, breachingSla: open.filter((incident) => incident.slaDueAt < readIsoNow()).length };
    },
  });
}
