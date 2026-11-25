locals {
  media_bucket_arn = module.storage.media_bucket.arn
  kyc_bucket_arn   = module.storage.kyc_bucket.arn
  s3_object_access = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"]
  media_key_users  = ["media", "go-live", "intelligence", "go-trust", "go-ads"]
  kyc_key_users    = ["go-identity", "go-trust"]
  task_role_arn    = { for name in distinct(concat(local.media_key_users, local.kyc_key_users)) : name => "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/nantty-${var.environment}-${name}-task" }
  media_key_access = { sid = "MediaKey", actions = ["kms:Decrypt", "kms:GenerateDataKey"], resources = [module.storage.media_kms_key_arn] }

  task_policies = {
    go-identity = [
      { sid = "KycDocuments", actions = local.s3_object_access, resources = ["${local.kyc_bucket_arn}/*"] },
      { sid = "KycList", actions = ["s3:ListBucket"], resources = [local.kyc_bucket_arn] },
      { sid = "KycKey", actions = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"], resources = [module.kms.key_arns["kyc"]] },
    ]
    media = [
      { sid = "MediaObjects", actions = local.s3_object_access, resources = ["${local.media_bucket_arn}/*"] },
      { sid = "MediaList", actions = ["s3:ListBucket"], resources = [local.media_bucket_arn] },
      { sid = "MediaServiceObjects", actions = concat(local.s3_object_access, ["s3:ListMultipartUploadParts"]), resources = [for bucket in values(module.storage.media_service_buckets) : "${bucket.arn}/*"] },
      { sid = "MediaServiceList", actions = ["s3:ListBucket", "s3:ListBucketMultipartUploads"], resources = [for bucket in values(module.storage.media_service_buckets) : bucket.arn] },
      local.media_key_access,
    ]
    go-live = [
      { sid = "LiveRecordings", actions = ["s3:GetObject", "s3:PutObject"], resources = ["${local.media_bucket_arn}/uploads/live-recordings/*"] },
      { sid = "LiveSafetyCaptureList", actions = ["s3:ListBucket"], resources = [local.media_bucket_arn], conditions = [{ test = "StringLike", variable = "s3:prefix", values = ["live-safety/frames/*", "live-safety/audio/*"] }] },
      local.media_key_access,
    ]
    intelligence = [
      { sid = "EventLog", actions = ["s3:GetObject", "s3:PutObject"], resources = ["${local.media_bucket_arn}/intelligence/*"] },
      { sid = "EventLogList", actions = ["s3:ListBucket"], resources = [local.media_bucket_arn] },
      { sid = "LiveSafetyCaptureRead", actions = ["s3:GetObject"], resources = ["${local.media_bucket_arn}/live-safety/frames/*", "${local.media_bucket_arn}/live-safety/audio/*"] },
      { sid = "LiveSafetyTranscripts", actions = ["s3:GetObject", "s3:PutObject"], resources = ["${local.media_bucket_arn}/live-safety/transcripts/*"] },
      local.media_key_access,
      { sid = "LiveSafetyRekognition", actions = ["rekognition:DetectModerationLabels"], resources = ["*"] },
      { sid = "LiveSafetyTranscribe", actions = ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"], resources = ["arn:aws:transcribe:${var.region}:${data.aws_caller_identity.current.account_id}:transcription-job/live-safety-*"] },
    ]
    go-ads = [
      { sid = "AdsAssets", actions = local.s3_object_access, resources = ["${local.media_bucket_arn}/ads-media/*", "${local.media_bucket_arn}/ads-reports/*"] },
      local.media_key_access,
    ]
    go-trust = [
      { sid = "LiveSafetyFramePreviews", actions = ["s3:GetObject"], resources = ["${local.media_bucket_arn}/live-safety/frames/*"] },
      { sid = "LiveSafetyEvidenceWrite", actions = ["s3:PutObject", "s3:PutObjectTagging", "s3:PutObjectLegalHold"], resources = ["${local.kyc_bucket_arn}/trust-evidence/live/*"] },
      { sid = "LiveSafetyEvidenceKey", actions = ["kms:Encrypt", "kms:GenerateDataKey"], resources = [module.kms.key_arns["kyc"]] },
      { sid = "LiveSafetyFrameKey", actions = ["kms:Decrypt"], resources = [module.storage.media_kms_key_arn] },
    ]
    notifications = [
      { sid = "SendMail", actions = ["ses:SendEmail", "ses:SendRawEmail"], resources = [module.ses.identity_arn, "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${module.ses.configuration_set_name}"] },
      { sid = "SesFeedbackQueue", actions = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"], resources = [module.ses.feedback_queue_arn] },
      { sid = "SesFeedbackKey", actions = ["kms:Decrypt"], resources = [module.kms.key_arns["sns"]] },
    ]
  }

  app_env = { dev = "staging", staging = "staging", prod = "production" }[var.environment]

  common_environment = {
    APP_ENV                 = local.app_env
    DEPLOYMENT_ENVIRONMENT  = var.environment
    LOG_LEVEL               = "info"
    AWS_REGION              = var.region
    EVENT_BUS               = "rabbitmq"
    RABBITMQ_PREFETCH       = "20"
    DATABASE_READ_HOST      = module.aurora.proxy_reader_endpoint
    AUTH_TOKEN_ISSUER       = "https://${local.api_domain}"
    AUTH_TOKEN_AUDIENCE     = "nantty-api"
    AUTH_JWKS_URL           = "${local.internal_url["go-identity"]}/.well-known/jwks.json"
    MEDIA_PUBLIC_BASE_URL   = "https://${local.media_domain}"
    MEDIA_BUCKET            = module.storage.media_bucket.id
    PUBLIC_API_BASE_URL     = "https://${local.api_domain}"
    OTEL_TRACES_SAMPLER     = "parentbased_traceidratio"
    OTEL_TRACES_SAMPLER_ARG = var.environment == "prod" ? "0.1" : "1.0"
  }

  runtime_environment = {
    go     = { HTTP_ADDRESS = "127.0.0.1:8080", OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4317" }
    node   = { HOST = "127.0.0.1", NODE_ENV = "production" }
    elixir = { PHX_SERVER = "true", PHX_HOST = local.api_domain, DNS_CLUSTER_QUERY = "realtime.${module.cluster.namespace_name}" }
    python = { OTEL_SEMCONV_STABILITY_OPT_IN = "http", INTELLIGENCE_ENVIRONMENT = local.app_env, INTELLIGENCE_HOST = "127.0.0.1", INTELLIGENCE_EVENT_STORAGE_URI = "s3://${module.storage.media_bucket.id}/intelligence" }
    gateway_only = merge(
      { CORS_ORIGINS = join(",", values(var.app_origins)), RATE_LIMIT_MAX_PER_MINUTE = "600", TRUSTED_PROXY_HOPS = "2" },
      { for name, url in local.internal_url : "UPSTREAM_${upper(replace(replace(name, "go-", ""), "-", "_"))}_URL" => url if contains(["go-identity", "go-live", "go-money", "go-trust", "go-commerce", "go-ads", "social", "notifications", "media", "search", "support"], name) },
    )
  }

  service_specific_environment = {
    gateway = merge(local.runtime_environment.gateway_only, { PORT = "8080", AUTH_JWKS_URL = "${local.internal_url["go-identity"]}/.well-known/jwks.json", ADMIN_IP_ALLOWLIST = join(",", var.admin_ip_allow_list), BLOCKED_CLIENT_IPS = join(",", var.blocked_client_ip_cidrs) })
    go-money = {
      PAYMENTS_MIGRATE_ON_START      = "false"
      WALLET_MIGRATE_ON_START        = "false"
      LEDGER_MIGRATE_ON_START        = "false"
      ESCROW_MIGRATE_ON_START        = "false"
      SUBSCRIPTIONS_MIGRATE_ON_START = "false"
      CREATORS_MIGRATE_ON_START      = "false"
    }
    social        = { PORT = "8105" }
    notifications = { PORT = "8104", PUSH_PROVIDER = "expo", NANTTY_WEB_BASE_URL = try(var.app_origins["web"], "https://${var.app_domain}"), SQS_SES_FEEDBACK_QUEUE_URL = module.ses.feedback_queue_url, SES_CONFIGURATION_SET = module.ses.configuration_set_name, SES_FROM_ADDRESS = "Nantty <noreply@${var.mail_domain}>", NANTTY_MAIL_SENDING_DOMAIN = var.mail_domain, IDENTITY_INTERNAL_URL = local.internal_url["go-identity"] }
    media = merge(
      {
        PORT                            = "8108"
        S3_REGION                       = var.region
        MEDIA_QUARANTINE_BUCKET         = module.storage.media_service_buckets["uploads"].id
        MEDIA_PUBLIC_BUCKET             = module.storage.media_service_buckets["public"].id
        MEDIA_PRIVATE_BUCKET            = module.storage.media_service_buckets["private"].id
        MEDIA_PRIVATE_KMS_KEY_ID        = module.storage.media_kms_key_arn
        MEDIA_ALLOW_UNSCANNED           = "false"
        MEDIA_REQUIRE_CHILD_SAFETY_SCAN = var.environment == "prod" ? "true" : "false"
        CDN_BASE_URL                    = "https://${local.media_domain}"
      },
      var.media_signing_public_key_pem == null ? {} : {
        CDN_PRIVATE_BASE_URL    = "https://${local.media_domain}"
        CDN_SIGNING_KEY_PAIR_ID = module.storage.media_signing_public_key_id
      },
      var.enable_media_malware_scanning ? {
        CLAMAV_HOST       = "127.0.0.1"
        CLAMAV_PORT       = "3310"
        CLAMAV_TIMEOUT_MS = "720000"
      } : {},
    )
    support      = { PORT = "8111" }
    realtime     = { PORT = "4000", ALLOWED_ORIGINS = join(",", values(var.app_origins)) }
    intelligence = { INTELLIGENCE_PORT = "8090", INTELLIGENCE_S3_REGION = var.region, INTELLIGENCE_TRUSTED_PROXY_IPS = var.vpc_cidr }
    go-identity = {
      HTTP_WRITE_TIMEOUT          = "30s"
      USERS_DOCUMENTS_BUCKET      = module.storage.kyc_bucket.id
      AUTH_OTP_DELIVERY           = "event"
      ADMIN_INVITATION_DELIVERY   = "none"
      ADMIN_CONSOLE_URL           = try(var.app_origins["admin"], "https://admin.${var.app_domain}")
      USERS_MEDIA_PUBLIC_BASE_URL = "https://${local.media_domain}"
      RABBITMQ_VHOST              = "nantty"
    }
    go-live = {
      LIVE_RECORDING_S3_BUCKET     = module.storage.media_bucket.id
      LIVE_RECORDING_S3_REGION     = var.region
      LIVE_SAFETY_SAMPLER_ENABLED  = "true"
      LIVE_SAFETY_FRAMES_S3_BUCKET = module.storage.media_bucket.id
      LIVE_SAFETY_FRAMES_S3_REGION = var.region
      LIVE_SAFETY_FRAMES_QUEUE     = "jobs-live-frames"
      LIVE_SAFETY_AUDIO_QUEUE      = "jobs-live-audio"
    }
    go-money = { MONEY_GRPC_ADDRESS = "127.0.0.1:9103", PAYMENTS_PROVIDER = "flutterwave" }
  }

  runtime_of = { for name, definition in local.services : name => (
    name == "realtime" ? "elixir" : name == "intelligence" ? "python" : definition.node ? "node" : "go"
  ) }

  database_url_names = {
    go-identity = ["AUTH_DATABASE_URL", "USERS_DATABASE_URL", "CURRENCY_DATABASE_URL", "ADMIN_DATABASE_URL"]
    go-commerce = ["CATALOG_DATABASE_URL", "INVENTORY_DATABASE_URL", "ORDERS_DATABASE_URL"]
    go-money    = ["MONEY_DATABASE_URL"]
    go-live     = ["LIVE_DATABASE_URL"]
    go-trust    = ["MODERATION_DATABASE_URL"]
    go-ads      = ["ADS_DATABASE_URL"]
  }

  valkey_url_names = {
    go-commerce = ["CATALOG_REDIS_URL", "INVENTORY_REDIS_URL", "ORDERS_REDIS_URL"]
    go-live     = ["LIVE_REDIS_URL"]
    go-ads      = ["ADS_REDIS_URL"]
  }

  database_schema_environment = {
    go-identity = { AUTH_DATABASE_SCHEMA = "auth", USERS_DATABASE_SCHEMA = "users", CURRENCY_DATABASE_SCHEMA = "currency", ADMIN_DATABASE_SCHEMA = "admin" }
    go-commerce = { CATALOG_DATABASE_SCHEMA = "catalog", INVENTORY_DATABASE_SCHEMA = "inventory", ORDERS_DATABASE_SCHEMA = "orders" }
    go-money    = { LEDGER_DATABASE_SCHEMA = "ledger" }
    go-live     = { LIVE_DATABASE_SCHEMA = "live" }
    go-trust    = { MODERATION_DATABASE_SCHEMA = "moderation" }
    go-ads      = { ADS_DATABASE_SCHEMA = "ads" }
  }

  service_secrets = {
    for name, definition in local.services : name => merge(
      { for key in definition.secret_keys : key => "${aws_secretsmanager_secret.app[name].arn}:${key}::" },
      definition.database ? { DATABASE_URL = "${module.aurora.service_role_secret_arns[local.database_roles[name]]}:${definition.node ? "prisma_url" : "url"}::" } : {},
      { for key in lookup(local.database_url_names, name, []) : key => "${module.aurora.service_role_secret_arns[local.database_roles[name]]}:url::" },
      { for key in lookup(local.valkey_url_names, name, []) : key => module.valkey.url_secret_arn },
      definition.rabbit ? { RABBITMQ_URL = "${module.messaging.service_user_secret_arns[name]}:url::" } : {},
      name == "go-identity" ? {
        RABBITMQ_MANAGEMENT_URL      = "${module.messaging.monitoring_secret_arn}:management_url::"
        RABBITMQ_MONITORING_USERNAME = "${module.messaging.monitoring_secret_arn}:username::"
        RABBITMQ_MONITORING_PASSWORD = "${module.messaging.monitoring_secret_arn}:password::"
      } : {},
      definition.valkey ? { VALKEY_URL = "${module.valkey.url_secret_arn}" } : {},
      definition.valkey && local.runtime_of[name] == "go" ? { AUTH_SESSION_DENYLIST_URL = module.valkey.url_secret_arn } : {},
      name == "intelligence" ? { INTELLIGENCE_REDIS_URL = module.valkey_intelligence.url_secret_arn } : {},
      name == "go-live" ? { for key in ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] : key => "${module.livekit.credentials_secret_arn}:${key}::" } : {},
      name == "go-live" ? { LIVEKIT_PUBLIC_URL = "${module.livekit.credentials_secret_arn}:LIVEKIT_URL::" } : {},
    )
  }

  service_secret_arns = {
    for name, definition in local.services : name => compact([
      aws_secretsmanager_secret.app[name].arn,
      definition.database ? module.aurora.service_role_secret_arns[local.database_roles[name]] : "",
      definition.rabbit ? module.messaging.service_user_secret_arns[name] : "",
      name == "go-identity" ? module.messaging.monitoring_secret_arn : "",
      definition.valkey ? module.valkey.url_secret_arn : "",
      name == "intelligence" ? module.valkey_intelligence.url_secret_arn : "",
      name == "go-live" ? module.livekit.credentials_secret_arn : "",
    ])
  }
}

module "service" {
  source   = "../ecs-service"
  for_each = local.services

  name                     = each.key
  environment              = var.environment
  region                   = var.region
  cluster_arn              = module.cluster.cluster_arn
  cluster_name             = module.cluster.cluster_name
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.private_subnet_ids
  security_group_ids       = each.key == "go-money" ? [aws_security_group.payments.id] : concat([aws_security_group.tasks.id, aws_security_group.service[each.key].id], each.key == "intelligence" ? [aws_security_group.intelligence.id] : [])
  image                    = module.ecr.repository_urls[each.key]
  image_tag                = var.image_tag
  cpu                      = each.value.cpu * 2
  memory                   = max(ceil((each.value.memory + 512 + (each.key == "media" && var.enable_media_malware_scanning ? 4096 : 0)) / 1024) * 1024, each.value.cpu * 4, each.key == "media" && var.enable_media_malware_scanning ? 8192 : 0)
  port                     = each.value.port
  extra_ports              = each.value.extra
  tls_proxy_image          = "${module.ecr.repository_urls["tls-proxy"]}:${var.image_tag}"
  tls_proxy_repository_arn = module.ecr.repository_arns["tls-proxy"]
  tls_secret_arn           = aws_secretsmanager_secret.tls[each.key].arn
  tls_config = jsonencode({
    identity   = local.tls_identity[each.key]
    ca         = aws_acmpca_certificate_authority_certificate.mesh.certificate
    alb        = length(each.value.public_rules) > 0
    app_port   = each.value.port
    ready_path = each.value.ready
    grpc_ports = each.value.extra
    clients    = [for name in local.tls_clients[each.key] : local.tls_identity[name]]
    upstreams = concat(
      [for target in local.internal_names : {
        name        = target
        dns         = local.tls_identity[target]
        local_port  = 20000 + index(local.internal_names, target)
        remote_port = 19443
        ready_path  = local.services[target].ready
      } if contains(local.tls_http_clients[target], each.key)],
      [for target, clients in local.tls_grpc_clients : {
        name        = "${target}-grpc"
        dns         = local.tls_identity[target]
        local_port  = target == "go-money" ? 29103 : 29101
        remote_port = target == "go-money" ? 19103 : 19101
      } if contains(clients, each.key)],
    )
  })
  health_path               = each.value.ready
  metrics_scrape_path       = contains(["go", "elixir"], local.runtime_of[each.key]) ? "/metrics" : null
  container_health_check    = each.value.health_command
  clamav_image              = each.key == "media" && var.enable_media_malware_scanning ? "${module.ecr.repository_urls["clamav"]}:${var.image_tag}" : null
  clamav_repository_arn     = each.key == "media" && var.enable_media_malware_scanning ? module.ecr.repository_arns["clamav"] : null
  clamav_memory_reservation = each.key == "media" && var.enable_media_malware_scanning ? 4096 : 0
  environment_variables     = merge(local.common_environment, local.runtime_environment[local.runtime_of[each.key]], lookup(local.service_specific_environment, each.key, {}), lookup(local.internal_wiring_environment, each.key, {}), lookup(local.database_schema_environment, each.key, {}))
  secrets                   = local.service_secrets[each.key]
  secret_arns               = local.service_secret_arns[each.key]
  secrets_kms_key_arn       = module.kms.key_arns["secrets"]
  logs_kms_key_arn          = module.kms.key_arns["logs"]
  task_policy_statements    = lookup(local.task_policies, each.key, [])
  min_count                 = each.value.min
  desired_count             = each.value.min
  max_count                 = each.value.max
  request_count_target      = each.value.request_target
  alb_arn_suffix            = module.edge.alb_arn_suffix
  namespace_id              = module.cluster.namespace_id
  enable_execute_command    = var.enable_execute_command
  log_retention_days        = var.log_retention_days
  use_spot                  = var.environment == "dev"
  blue_green                = false
  deployment_alarm_names    = each.key == "go-money" ? [module.observability.ledger_imbalance_alarm_name, module.observability.alb_5xx_alarm_name] : []
  listener_rules = [for rule in each.value.public_rules : {
    listener_arn  = module.edge.https_listener_arn, priority = rule.priority,
    path_patterns = rule.path_patterns, host_headers = []
  }]
  depends_on = [aws_lambda_invocation.tls_bootstrap]
}

module "observability" {
  source                      = "../observability"
  environment                 = var.environment
  region                      = var.region
  sns_kms_key_id              = module.kms.key_ids["sns"]
  alarm_email                 = var.alarm_email
  cluster_name                = module.cluster.cluster_name
  service_names               = local.service_names
  alb_arn_suffix              = module.edge.alb_arn_suffix
  aurora_cluster_identifier   = module.aurora.cluster_identifier
  valkey_replication_group_id = module.valkey.replication_group_id
  mq_broker_name              = module.messaging.broker_name
  ses_feedback_dlq_name       = module.ses.feedback_dead_letter_queue_name
  service_log_group_names     = { for name in local.service_names : name => module.service[name].log_group_name if local.runtime_of[name] == "go" }
  target_group_arn_suffixes = {
    for name, definition in local.services : name => {
      load_balancer_suffix = module.edge.alb_arn_suffix
      target_group_suffix  = module.service[name].target_group_arn_suffix
    } if length(definition.public_rules) > 0
  }
}
