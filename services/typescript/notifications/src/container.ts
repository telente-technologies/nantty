import { readEmailBrandFromEnvironment } from "@nantty/email-templates";
import type { Logger } from "@nantty/fastify-platform";

import type { NotificationsConfig } from "./configs/notifications.config.js";
import { createPrismaClient, type PrismaClient } from "./databases/prisma.database.js";
import { IdentityHttpDirectory } from "./integrations/identityDirectory.integration.js";
import { ExpoPushSender } from "./integrations/expoPush.integration.js";
import { FcmPushSender } from "./integrations/fcmPush.integration.js";
import { ProviderAwarePushSender } from "./integrations/providerAwarePush.integration.js";
import { SocialHttpDigestSource } from "./integrations/digestSource.integration.js";
import { SocialHttpPostNotificationSubscribers } from "./integrations/postNotificationSubscribers.integration.js";
import type { PostNotificationSubscriberSource } from "./interfaces/postNotificationSubscribers.interface.js";
import { postNotificationFanoutBatchSize, widgetRefreshFanoutBatchSize, widgetRefreshMaximumDirectRecipients } from "./constants/delivery.constant.js";
import { RunPostNotificationFanoutHandler } from "./modules/postNotifications/commands/runPostNotificationFanout/runPostNotificationFanout.handler.js";
import { LoggingEmailSender } from "./integrations/loggingEmail.integration.js";
import { SesEmailSender } from "./integrations/sesEmail.integration.js";
import { RabbitMqMessageBroker } from "./integrations/rabbitMqBroker.integration.js";
import { RabbitMqConnection } from "./integrations/rabbitMqConnection.integration.js";
import { SqsMessageBroker, SqsQueueClient } from "./integrations/sqs.integration.js";
import type { CampaignRepository, NoticeDraftRepository } from "./interfaces/campaignRepository.interface.js";
import type { EmailSender } from "./interfaces/emailSender.interface.js";
import type { IdentityDirectory } from "./interfaces/identityDirectory.interface.js";
import type { JobQueue, MessageBroker, QueueReader } from "./interfaces/jobQueue.interface.js";
import type { PushSender } from "./interfaces/pushSender.interface.js";
import type { ReengagementRepository } from "./interfaces/reengagementRepository.interface.js";
import type { DeliveryRepository, DeviceTokenRepository, NotificationRepository, PreferenceRepository, SuppressionRepository, UnsubscribeReceiptRepository } from "./interfaces/repositories.interface.js";
import { StaffAuthenticator } from "./middlewares/staffAuth.middleware.js";
import { DeliverEmailIfStillUnreadHandler } from "./modules/delivery/commands/deliverEmailIfStillUnread/deliverEmailIfStillUnread.handler.js";
import { DeliverTemplateEmailHandler } from "./modules/delivery/commands/deliverTemplateEmail/deliverTemplateEmail.handler.js";
import { RunDigestBatchHandler } from "./modules/digests/commands/runDigestBatch/runDigestBatch.handler.js";
import { DeliveryPrismaRepository } from "./modules/delivery/repositories/delivery.prisma.repository.js";
import { EmailDeliveryService } from "./modules/delivery/services/emailDelivery.service.js";
import { NotificationDispatcherService } from "./modules/delivery/services/notificationDispatcher.service.js";
import { SupportInboxAlertService } from "./modules/delivery/services/supportInboxAlert.service.js";
import { ListFailedEmailDeliveriesHandler } from "./modules/delivery/queries/listFailedEmailDeliveries/listFailedEmailDeliveries.handler.js";
import { ListFailedPushDeliveriesHandler } from "./modules/delivery/queries/listFailedPushDeliveries/listFailedPushDeliveries.handler.js";
import { QueueAdminEmailHandler } from "./modules/bulkCampaigns/commands/queueAdminEmail/queueAdminEmail.handler.js";
import { ProcessBulkBatchHandler } from "./modules/bulkCampaigns/commands/processBulkBatch/processBulkBatch.handler.js";
import { QueueLegalNoticeHandler } from "./modules/bulkCampaigns/commands/queueLegalNotice/queueLegalNotice.handler.js";
import { CampaignPrismaRepository } from "./modules/bulkCampaigns/repositories/campaign.prisma.repository.js";
import { PreviewAdminEmailHandler } from "./modules/bulkCampaigns/queries/previewAdminEmail/previewAdminEmail.handler.js";
import { ListAdminEmailSendsHandler } from "./modules/bulkCampaigns/queries/listAdminEmailSends/listAdminEmailSends.handler.js";
import { ListAdminEmailReferenceDataHandler } from "./modules/bulkCampaigns/queries/listAdminEmailReferenceData/listAdminEmailReferenceData.handler.js";
import { ListLegalNoticesHandler } from "./modules/bulkCampaigns/queries/listLegalNotices/listLegalNotices.handler.js";
import { PreviewLegalNoticeHandler } from "./modules/bulkCampaigns/queries/previewLegalNotice/previewLegalNotice.handler.js";
import { AudiencePlannerService } from "./modules/bulkCampaigns/services/audiencePlanner.service.js";
import { LegalAudienceService } from "./modules/bulkCampaigns/services/legalAudience.service.js";
import { PreviewEmailTemplateHandler } from "./modules/emailTemplates/queries/previewEmailTemplate/previewEmailTemplate.handler.js";
import { HandleDomainEventHandler } from "./modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { SendWidgetRefreshHandler } from "./modules/widgetRefresh/commands/sendWidgetRefresh/sendWidgetRefresh.handler.js";
import { ListNotificationPreferencesHandler } from "./modules/inbox/queries/listNotificationPreferences/listNotificationPreferences.handler.js";
import { GetUnreadCountHandler } from "./modules/inbox/queries/getUnreadCount/getUnreadCount.handler.js";
import { ListNotificationsHandler } from "./modules/inbox/queries/listNotifications/listNotifications.handler.js";
import { MarkAllNotificationsReadHandler } from "./modules/inbox/commands/markAllNotificationsRead/markAllNotificationsRead.handler.js";
import { MarkNotificationReadHandler } from "./modules/inbox/commands/markNotificationRead/markNotificationRead.handler.js";
import { RegisterDeviceTokenHandler } from "./modules/inbox/commands/registerDeviceToken/registerDeviceToken.handler.js";
import { RemoveDeviceTokenHandler } from "./modules/inbox/commands/removeDeviceToken/removeDeviceToken.handler.js";
import { RecordActivityHandler } from "./modules/reengagement/commands/recordActivity/recordActivity.handler.js";
import { ProcessReengagementHandler } from "./modules/reengagement/commands/processReengagement/processReengagement.handler.js";
import { ReengagementPrismaRepository } from "./modules/reengagement/repositories/reengagement.prisma.repository.js";
import { UpdateNotificationPreferenceHandler } from "./modules/inbox/commands/updateNotificationPreference/updateNotificationPreference.handler.js";
import { DeviceTokenPrismaRepository } from "./modules/inbox/repositories/deviceToken.prisma.repository.js";
import { NotificationPrismaRepository } from "./modules/inbox/repositories/notification.prisma.repository.js";
import { PreferencePrismaRepository } from "./modules/inbox/repositories/preference.prisma.repository.js";
import { CreateDraftFromPublishedPolicyHandler } from "./modules/noticeDrafts/commands/createDraftFromPublishedPolicy/createDraftFromPublishedPolicy.handler.js";
import { SendNoticeTestEmailHandler } from "./modules/noticeDrafts/commands/sendNoticeTestEmail/sendNoticeTestEmail.handler.js";
import { UpdateNoticeDraftHandler } from "./modules/noticeDrafts/commands/updateNoticeDraft/updateNoticeDraft.handler.js";
import { GetNoticeDraftHandler } from "./modules/noticeDrafts/queries/getNoticeDraft/getNoticeDraft.handler.js";
import { NoticeDraftProvisionerService } from "./modules/noticeDrafts/services/noticeDraftProvisioner.service.js";
import { IdentityLegalVersionSource } from "./integrations/identityLegalVersions.integration.js";
import type { LegalVersionSource } from "./interfaces/legalVersionSource.interface.js";
import { NoticeDraftPrismaRepository } from "./modules/noticeDrafts/repositories/noticeDraft.prisma.repository.js";
import { RecordSesFeedbackHandler } from "./modules/suppression/commands/recordSesFeedback/recordSesFeedback.handler.js";
import { SuppressionPrismaRepository } from "./modules/suppression/repositories/suppression.prisma.repository.js";
import { UnsubscribeFromMarketingHandler } from "./modules/unsubscribe/commands/unsubscribeFromMarketing/unsubscribeFromMarketing.handler.js";
import { UnsubscribeReceiptPrismaRepository } from "./modules/unsubscribe/repositories/unsubscribeReceipt.prisma.repository.js";
import { UnsubscribeTokenService } from "./modules/unsubscribe/services/unsubscribeToken.service.js";
import type { DomainEventEnvelope } from "./types/domainEvent.type.js";

export interface ContainerOverrides {
  readonly prisma?: PrismaClient;
  readonly emailSender?: EmailSender;
  readonly identity?: IdentityDirectory;
  readonly jobQueue?: JobQueue;
  readonly broker?: MessageBroker;
  readonly sesFeedbackReader?: QueueReader | null;
  readonly pushSender?: PushSender;
  readonly staffAuthenticator?: StaffAuthenticator;
  readonly legalVersions?: LegalVersionSource | null;
  readonly pause?: (milliseconds: number) => Promise<void>;
  readonly postNotificationSubscribers?: PostNotificationSubscriberSource | null;
  readonly reengagementRepository?: ReengagementRepository;
}

export function createContainer(config: NotificationsConfig, logger: Logger, overrides: ContainerOverrides = {}) {
  const prisma = overrides.prisma ?? createPrismaClient(config);
  const broker = overrides.broker ?? createMessageBroker(config, logger);
  const jobQueue: JobQueue = overrides.jobQueue ?? broker;
  const sesFeedbackReader = overrides.sesFeedbackReader !== undefined ? overrides.sesFeedbackReader : config.queues.sesFeedback === "" ? null : new SqsQueueClient(config.aws.region, config.aws.endpoint);
  const identity: IdentityDirectory = overrides.identity ?? new IdentityHttpDirectory(config.identity.baseUrl, config.identity.internalToken);
  const emailSender: EmailSender = overrides.emailSender ?? (config.emailProvider === "log" ? new LoggingEmailSender(logger) : new SesEmailSender({ region: config.aws.region, endpoint: config.aws.endpoint, fromAddress: config.email.fromAddress, configurationSet: config.email.configurationSet }));
  const pushSender: PushSender = overrides.pushSender ?? new ProviderAwarePushSender(
    config.pushProvider,
    new ExpoPushSender(),
    config.fcm === undefined ? null : new FcmPushSender(config.fcm),
    logger,
  );
  const brand = readEmailBrandFromEnvironment(process.env);
  const acceptUrl = `${config.webBaseUrl}/settings/legal/accept`;

  const notifications: NotificationRepository = new NotificationPrismaRepository(prisma, config.webBaseUrl);
  const deliveries: DeliveryRepository = new DeliveryPrismaRepository(prisma);
  const preferences: PreferenceRepository = new PreferencePrismaRepository(prisma);
  const deviceTokens: DeviceTokenRepository = new DeviceTokenPrismaRepository(prisma);
  const suppressions: SuppressionRepository = new SuppressionPrismaRepository(prisma);
  const campaigns: CampaignRepository = new CampaignPrismaRepository(prisma);
  const drafts: NoticeDraftRepository = new NoticeDraftPrismaRepository(prisma);
  const unsubscribeReceipts: UnsubscribeReceiptRepository = new UnsubscribeReceiptPrismaRepository(prisma);
  const reengagementRepository: ReengagementRepository = overrides.reengagementRepository ?? new ReengagementPrismaRepository(prisma);

  const unsubscribeTokens = new UnsubscribeTokenService(config.unsubscribeSigningSecret, config.publicApiBaseUrl, config.unsubscribeTokenTtlSeconds);
  const emailDelivery = new EmailDeliveryService({ sender: emailSender, deliveries, suppressions, preferences, unsubscribeTokens, marketingMaxPerWeek: config.marketingMaxPerWeek, brand });
  const dispatcher = new NotificationDispatcherService({ notifications, deliveries, preferences, deviceTokens, identity, emailDelivery, pushSender, jobQueue, jobsQueueUrl: config.queues.jobs });

  const { batchSize, ratePerSecond } = config.policyNotice;
  const legalAudience = new LegalAudienceService(identity, suppressions, batchSize, ratePerSecond);
  const queueLegalNotice = new QueueLegalNoticeHandler({ drafts, campaigns, audience: legalAudience, jobQueue, jobsQueueUrl: config.queues.jobs, identity, batchSize, ratePerSecond, acceptUrl });
  const planner = new AudiencePlannerService(identity);
  const supportInbox = config.supportInbox === undefined ? undefined : new SupportInboxAlertService({ emailDelivery, jobQueue, jobsQueueUrl: config.queues.jobs, ...config.supportInbox });
  const subscriberSource = overrides.postNotificationSubscribers !== undefined ? overrides.postNotificationSubscribers
    : config.digestSource === null ? null : new SocialHttpPostNotificationSubscribers(config.digestSource.baseUrl, config.digestSource.internalToken);
  const runPostNotificationFanout = subscriberSource === null ? null : new RunPostNotificationFanoutHandler({
    source: subscriberSource, dispatcher, jobQueue, jobsQueueUrl: config.queues.jobs, batchSize: postNotificationFanoutBatchSize, lookupAuthor: (accountId) => identity.getRecipient(accountId), pages: deliveries,
  });
  const sendWidgetRefresh = new SendWidgetRefreshHandler({
    deliveries, deviceTokens, pushSender, jobQueue, jobsQueueUrl: config.queues.jobs, storyAudience: subscriberSource, batchSize: widgetRefreshFanoutBatchSize, maximumDirectRecipients: widgetRefreshMaximumDirectRecipients, logger,
  });
  const policyPublished = new CreateDraftFromPublishedPolicyHandler(drafts, config.webBaseUrl, config.policyNotice.autoSend, queueLegalNotice);

  return {
    prisma,
    broker,
    sesFeedbackReader,
    staffAuthenticator: overrides.staffAuthenticator ?? new StaffAuthenticator({ jwksUrl: config.auth.jwksUrl, issuer: config.auth.staffIssuer }),
    unsubscribeTokens,
    unsubscribeFromMarketing: new UnsubscribeFromMarketingHandler(unsubscribeTokens, identity, unsubscribeReceipts),
    listNotifications: new ListNotificationsHandler(notifications, config.webBaseUrl),
    getUnreadCount: new GetUnreadCountHandler(notifications),
    markNotificationRead: new MarkNotificationReadHandler(notifications),
    markAllNotificationsRead: new MarkAllNotificationsReadHandler(notifications),
    listNotificationPreferences: new ListNotificationPreferencesHandler(preferences),
    updateNotificationPreference: new UpdateNotificationPreferenceHandler(preferences),
    reengagementRepository,
    recordActivity: new RecordActivityHandler(reengagementRepository),
    processReengagement: new ProcessReengagementHandler({ repository: reengagementRepository, identity, preferences, dispatcher, quietHours: config.reengagement }),
    registerDeviceToken: new RegisterDeviceTokenHandler(deviceTokens),
    removeDeviceToken: new RemoveDeviceTokenHandler(deviceTokens),
    listAdminEmailReferenceData: new ListAdminEmailReferenceDataHandler(identity),
    listAdminEmailSends: new ListAdminEmailSendsHandler(campaigns),
    listFailedEmailDeliveries: new ListFailedEmailDeliveriesHandler(deliveries),
    listFailedPushDeliveries: new ListFailedPushDeliveriesHandler(deliveries),
    previewAdminEmail: new PreviewAdminEmailHandler(planner),
    queueAdminEmail: new QueueAdminEmailHandler({ planner, campaigns, jobQueue, jobsQueueUrl: config.queues.jobs, identity, batchSize, ratePerSecond }),
    noticeDraftProvisioner: new NoticeDraftProvisionerService(drafts, overrides.legalVersions !== undefined ? overrides.legalVersions : new IdentityLegalVersionSource(config.identity.baseUrl), config.webBaseUrl),
    getNoticeDraft: new GetNoticeDraftHandler(drafts),
    updateNoticeDraft: new UpdateNoticeDraftHandler(drafts, identity),
    sendNoticeTestEmail: new SendNoticeTestEmailHandler({ drafts, identity, sender: emailSender, acceptUrl, brand }),
    previewLegalNotice: new PreviewLegalNoticeHandler(drafts, legalAudience, batchSize, ratePerSecond),
    listLegalNotices: new ListLegalNoticesHandler(campaigns, drafts),
    queueLegalNotice,
    previewEmailTemplate: new PreviewEmailTemplateHandler(brand, config.webBaseUrl),
    handleDomainEvent: new HandleDomainEventHandler(dispatcher, policyPublished, { webBaseUrl: config.webBaseUrl, sellerDashboardUrl: brand.sellerDashboardUrl, otpEnvelopeKeys: config.otpEnvelopeKeys }, logger, supportInbox, runPostNotificationFanout ?? undefined, sendWidgetRefresh, notifications),
    runPostNotificationFanout,
    sendWidgetRefresh,
    processBulkBatch: new ProcessBulkBatchHandler({ campaigns, identity, emailDelivery, jobQueue, jobsQueueUrl: config.queues.jobs, pause: overrides.pause ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) }),
    deliverEmailIfStillUnread: new DeliverEmailIfStillUnreadHandler({ notifications, deliveries, identity, emailDelivery, jobQueue, jobsQueueUrl: config.queues.jobs, supportInbox, logger }),
    deliverTemplateEmail: new DeliverTemplateEmailHandler({ identity, emailDelivery, jobQueue, jobsQueueUrl: config.queues.jobs, supportInbox, logger }),
    deliverSupportTicketAlert: { execute: async (event: DomainEventEnvelope) => { await supportInbox?.deliverTicketCreated(event); } },
    deliverFailedEmailAlert: { execute: async (input: { eventId: string; templateKey: string; reason: string; address: string }) => { await supportInbox?.deliverEmailDeliveryFailed(input); } },
    runDigestBatch: config.digestSource === null ? null : new RunDigestBatchHandler({ source: new SocialHttpDigestSource(config.digestSource.baseUrl, config.digestSource.internalToken), identity, emailDelivery, jobQueue, jobsQueueUrl: config.queues.jobs, batchSize }),
    recordSesFeedback: new RecordSesFeedbackHandler(suppressions),
  };
}

export type Container = ReturnType<typeof createContainer>;

function createMessageBroker(config: NotificationsConfig, logger: Logger): MessageBroker {
  if (config.messageBus === "sqs") return new SqsMessageBroker(new SqsQueueClient(config.aws.region, config.aws.endpoint), logger);
  return new RabbitMqMessageBroker(new RabbitMqConnection(config.rabbitMq.url, "notifications", logger), config.rabbitMq.prefetch, logger);
}
