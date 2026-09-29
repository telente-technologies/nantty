import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { MediaLibrary } from "../interfaces/mediaLibrary.interface.js";
import type { ModerationTargetGateway } from "../interfaces/moderationTargets.interface.js";
import type { RealtimePublisher } from "../interfaces/realtimePublisher.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../interfaces/userDirectory.interface.js";
import { AutomationController } from "../modules/automation/controllers/automation.controller.js";
import { registerAutomationCommandAndQueryHandlers } from "../modules/automation/automation.module.js";
import { createAutomationOccurrenceCleanupJob } from "../modules/automation/jobs/automationMaintenance.job.js";
import { PrismaAutomationExecutionsRepository, PrismaAutomationRulesRepository } from "../modules/automation/repositories/automation.prisma.repository.js";
import { InMemoryAutomationExecutionsRepository, InMemoryAutomationRulesRepository } from "../modules/automation/repositories/automation.repository.js";
import { AutomationActionRunner } from "../modules/automation/services/automationActions.service.js";
import { AutomationEngine } from "../modules/automation/services/automationEngine.service.js";
import { AutomationRulesService } from "../modules/automation/services/automationRules.service.js";
import { subscribeAutomationTriggers } from "../modules/automation/triggers/automationTriggers.trigger.js";
import { ModerationController } from "../modules/moderation/controllers/moderation.controller.js";
import { registerModerationCommandAndQueryHandlers } from "../modules/moderation/moderation.module.js";
import { PrismaModerationDecisionsRepository } from "../modules/moderation/repositories/decisions.prisma.repository.js";
import { InMemoryModerationDecisionsRepository, type ModerationDecisionsRepository } from "../modules/moderation/repositories/decisions.repository.js";
import { PrismaModerationCasesRepository, PrismaModerationReportsRepository } from "../modules/moderation/repositories/reportsAndCases.prisma.repository.js";
import { InMemoryModerationCasesRepository, InMemoryModerationReportsRepository } from "../modules/moderation/repositories/reportsAndCases.repository.js";
import { ModerationAccountSuspensions } from "../modules/moderation/services/accountSuspensionManager.service.js";
import { AutomatedModerationQueue } from "../modules/moderation/services/automatedModerationQueue.service.js";
import { ModerationEnforcementService } from "../modules/moderation/services/moderationEnforcement.service.js";
import { ModerationService } from "../modules/moderation/services/moderation.service.js";
import { ModerationTargetRegistry } from "../modules/moderation/services/moderationTargetRegistry.service.js";
import { UserModerationTarget } from "../modules/moderation/services/userModerationTarget.service.js";
import { SupportController } from "../modules/support/controllers/support.controller.js";
import { PrismaContactRequestsRepository, PrismaSupportTicketsRepository } from "../modules/support/repositories/support.prisma.repository.js";
import { InMemoryContactRequestsRepository, InMemorySupportTicketsRepository } from "../modules/support/repositories/support.repository.js";
import { SupportService } from "../modules/support/services/support.service.js";
import { EmailSupportInbox, IntegrationSupportEmailSender, type SupportEmailSender } from "../modules/support/services/supportInbox.service.js";
import { registerSupportCommandAndQueryHandlers } from "../modules/support/support.module.js";
import type { Core } from "./core.loader.js";

export interface TrustAndSafetyExternalServices {
  readonly supportEmailSender?: SupportEmailSender;
}

export interface TrustAndSafetySharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory & UserAccountStandingLookup;
  readonly mediaLibrary: MediaLibrary;
  readonly realtime: RealtimePublisher;
  readonly moderationDecisions: ModerationDecisionsRepository;
  readonly moderationTargets: readonly ModerationTargetGateway[];
}

export function createModerationDecisionsRepository(core: Core): ModerationDecisionsRepository {
  return core.persistence === "prisma" ? new PrismaModerationDecisionsRepository() : new InMemoryModerationDecisionsRepository();
}

function createModerationModule(core: Core, shared: TrustAndSafetySharedServices) {
  const usePrisma = core.persistence === "prisma";
  const targets = new ModerationTargetRegistry();
  for (const gateway of [new UserModerationTarget(shared.userDirectory), ...shared.moderationTargets]) targets.register(gateway);
  const moderationService = new ModerationService({
    reports: usePrisma ? new PrismaModerationReportsRepository() : new InMemoryModerationReportsRepository(),
    cases: usePrisma ? new PrismaModerationCasesRepository() : new InMemoryModerationCasesRepository(),
    decisions: shared.moderationDecisions,
    targets,
    userDirectory: shared.userDirectory,
    audit: shared.audit,
    events: core.events,
    commands: core.commands,
    realtime: shared.realtime,
    clock: core.clock,
  });
  const enforcement = new ModerationEnforcementService(moderationService);
  registerModerationCommandAndQueryHandlers(core.commands, core.queries, moderationService, enforcement);
  return {
    moderationService,
    moderationQueue: new AutomatedModerationQueue(moderationService, enforcement),
    accountSuspensions: new ModerationAccountSuspensions(moderationService, enforcement),
  };
}

function createAutomationModule(core: Core, shared: TrustAndSafetySharedServices, moderation: ReturnType<typeof createModerationModule>) {
  const usePrisma = core.persistence === "prisma";
  const rules = usePrisma ? new PrismaAutomationRulesRepository() : new InMemoryAutomationRulesRepository();
  const executions = usePrisma ? new PrismaAutomationExecutionsRepository() : new InMemoryAutomationExecutionsRepository();
  const engine = new AutomationEngine({ rules, executions, actions: new AutomationActionRunner(moderation.moderationQueue), clock: core.clock, logger: core.logger });
  subscribeAutomationTriggers(core.events, engine, {
    accountStanding: shared.userDirectory,
    countModerationStrikes: async (userId) =>
      (await shared.moderationDecisions.listDecisionsAffectingUser(userId, 100)).filter((decision) => decision.action !== "dismiss" && decision.reversedAt === null).length,
    clock: core.clock,
  });
  const rulesService = new AutomationRulesService({
    rules,
    executions,
    audit: shared.audit,
    clock: core.clock,
    defaultExecutionsPerHour: core.settings.communication.automationDefaultExecutionsPerHour,
  });
  registerAutomationCommandAndQueryHandlers(core.commands, core.queries, rulesService);
  return { engine };
}

export function createTrustAndSafetyModules(core: Core, shared: TrustAndSafetySharedServices, external: TrustAndSafetyExternalServices) {
  const usePrisma = core.persistence === "prisma";
  const moderation = createModerationModule(core, shared);
  const automation = createAutomationModule(core, shared, moderation);
  const supportInbox = new EmailSupportInbox(external.supportEmailSender ?? new IntegrationSupportEmailSender(), core.settings.communication.supportNotificationEmails);
  const supportService = new SupportService({
    tickets: usePrisma ? new PrismaSupportTicketsRepository() : new InMemorySupportTicketsRepository(),
    contactRequests: usePrisma ? new PrismaContactRequestsRepository() : new InMemoryContactRequestsRepository(),
    userDirectory: shared.userDirectory,
    mediaLibrary: shared.mediaLibrary,
    supportInbox,
    audit: shared.audit,
    events: core.events,
    cipher: core.cipher,
    clock: core.clock,
    logger: core.logger,
  });
  registerSupportCommandAndQueryHandlers(core.commands, core.queries, supportService);
  return {
    supportInbox,
    moderationQueue: moderation.moderationQueue,
    accountSuspensions: moderation.accountSuspensions,
    scheduledJobs: [createAutomationOccurrenceCleanupJob(automation.engine)],
    controllers: {
      moderationController: new ModerationController(core.commands, core.queries),
      supportController: new SupportController(core.commands, core.queries),
      automationController: new AutomationController(core.commands, core.queries),
    },
  };
}
