locals {
  media_bucket_arn = module.storage.media_bucket.arn
  kyc_bucket_arn   = module.storage.kyc_bucket.arn
  s3_object_access = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"]

  task_policies = {
    go-identity = [
      { sid = "KycDocuments", actions = local.s3_object_access, resources = ["${local.kyc_bucket_arn}/*"] },
      { sid = "KycList", actions = ["s3:ListBucket"], resources = [local.kyc_bucket_arn] },
      { sid = "KycKey", actions = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"], resources = [module.kms.key_arns["kyc"]] },
    ]
    media = [
      { sid = "MediaObjects", actions = local.s3_object_access, resources = ["${local.media_bucket_arn}/*"] },
      { sid = "MediaList", actions = ["s3:ListBucket"], resources = [local.media_bucket_arn] },
    ]
    go-live = [
      { sid = "LiveRecordings", actions = ["s3:GetObject", "s3:PutObject"], resources = ["${local.media_bucket_arn}/uploads/live-recordings/*"] },
    ]
    intelligence = [
      { sid = "EventLog", actions = ["s3:GetObject", "s3:PutObject"], resources = ["${local.media_bucket_arn}/intelligence/*"] },
      { sid = "EventLogList", actions = ["s3:ListBucket"], resources = [local.media_bucket_arn] },
    ]
    notifications = [
      { sid = "SendMail", actions = ["ses:SendEmail", "ses:SendRawEmail"], resources = [module.ses.identity_arn, "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${module.ses.configuration_set_name}"] },
      { sid = "SesFeedbackQueue", actions = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"], resources = [module.ses.feedback_queue_arn] },
      { sid = "SesFeedbackKey", actions = ["kms:Decrypt"], resources = [module.kms.key_arns["sns"]] },
    ]
  }

  common_environment = {
    APP_ENV                 = var.environment
    LOG_LEVEL               = "info"
    AWS_REGION              = var.region
    EVENT_BUS               = "rabbitmq"
    RABBITMQ_PREFETCH       = "20"
    DATABASE_READ_HOST      = module.aurora.proxy_reader_endpoint
    AUTH_TOKEN_ISSUER       = "https://${local.api_domain}"
    AUTH_TOKEN_AUDIENCE     = "zudomart-api"
    AUTH_JWKS_URL           = "${local.internal_url["go-identity"]}/.well-known/jwks.json"
    MEDIA_PUBLIC_BASE_URL   = "https://${local.media_domain}"
    MEDIA_BUCKET            = module.storage.media_bucket.id
    PUBLIC_API_BASE_URL     = "https://${local.api_domain}"
    OTEL_TRACES_SAMPLER     = "parentbased_traceidratio"
    OTEL_TRACES_SAMPLER_ARG = var.environment == "prod" ? "0.1" : "1.0"
  }

  runtime_environment = {
    go     = { HTTP_ADDRESS = ":8080" }
    node   = { HOST = "0.0.0.0", NODE_ENV = "production" }
    elixir = { PHX_SERVER = "true", PHX_HOST = local.api_domain, DNS_CLUSTER_QUERY = "realtime.${module.cluster.namespace_name}" }
    python = { INTELLIGENCE_ENVIRONMENT = var.environment, INTELLIGENCE_HOST = "0.0.0.0", INTELLIGENCE_EVENT_STORAGE_URI = "s3://${module.storage.media_bucket.id}/intelligence" }
    gateway_only = merge(
      { CORS_ORIGINS = join(",", values(var.app_origins)), RATE_LIMIT_MAX_PER_MINUTE = "600" },
      { for name, url in local.internal_url : "UPSTREAM_${upper(replace(replace(name, "go-", ""), "-", "_"))}_URL" => url if contains(["go-identity", "go-live", "go-money", "go-trust", "go-commerce", "social", "notifications"], name) },
    )
  }

  service_specific_environment = {
    gateway       = merge(local.runtime_environment.gateway_only, { PORT = "8080", AUTH_JWKS_URL = "${local.internal_url["go-identity"]}/.well-known/jwks.json" })
    social        = { PORT = "8105" }
    notifications = { PORT = "8104", SQS_SES_FEEDBACK_QUEUE_URL = module.ses.feedback_queue_url, SES_CONFIGURATION_SET = module.ses.configuration_set_name, SES_FROM_ADDRESS = "Zudomart <no-reply@${var.mail_domain}>", IDENTITY_INTERNAL_URL = local.internal_url["go-identity"] }
    media         = { PORT = "8108" }
    realtime      = { PORT = "4000" }
    intelligence  = { INTELLIGENCE_PORT = "8090" }
    go-identity   = { USERS_DOCUMENTS_BUCKET = module.storage.kyc_bucket.id }
    go-live       = { LIVE_RECORDING_S3_BUCKET = module.storage.media_bucket.id }
    go-money      = { MONEY_GRPC_ADDRESS = ":9103", PAYMENTS_DEFAULT_PROVIDER = "paystack" }
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
    go-commerce  = ["CATALOG_REDIS_URL", "INVENTORY_REDIS_URL", "ORDERS_REDIS_URL"]
    go-live      = ["LIVE_REDIS_URL"]
    go-ads       = ["ADS_REDIS_URL"]
    intelligence = ["INTELLIGENCE_REDIS_URL"]
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
      definition.valkey ? { VALKEY_URL = "${module.valkey.url_secret_arn}" } : {},
      name == "go-live" ? { for key in ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] : key => "${module.livekit.credentials_secret_arn}:${key}::" } : {},
      name == "go-live" ? { LIVEKIT_PUBLIC_URL = "${module.livekit.credentials_secret_arn}:LIVEKIT_URL::" } : {},
    )
  }

  service_secret_arns = {
    for name, definition in local.services : name => compact([
      aws_secretsmanager_secret.app[name].arn,
      definition.database ? module.aurora.service_role_secret_arns[local.database_roles[name]] : "",
      definition.rabbit ? module.messaging.service_user_secret_arns[name] : "",
      definition.valkey ? module.valkey.url_secret_arn : "",
      name == "go-live" ? module.livekit.credentials_secret_arn : "",
    ])
  }
}

module "service" {
  source   = "../ecs-service"
  for_each = local.services

  name                    = each.key
  environment             = var.environment
  region                  = var.region
  cluster_arn             = module.cluster.cluster_arn
  cluster_name            = module.cluster.cluster_name
  vpc_id                  = module.network.vpc_id
  subnet_ids              = module.network.private_subnet_ids
  security_group_ids      = [aws_security_group.tasks.id]
  image                   = module.ecr.repository_urls[each.key]
  image_tag               = var.image_tag
  cpu                     = each.value.cpu
  memory                  = each.value.memory
  port                    = each.value.port
  extra_ports             = each.value.extra
  health_path             = each.value.health
  container_health_check  = each.value.health_command
  environment_variables   = merge(local.common_environment, local.runtime_environment[local.runtime_of[each.key]], lookup(local.service_specific_environment, each.key, {}), lookup(local.database_schema_environment, each.key, {}))
  secrets                 = local.service_secrets[each.key]
  secret_arns             = local.service_secret_arns[each.key]
  secrets_kms_key_arn     = module.kms.key_arns["secrets"]
  logs_kms_key_arn        = module.kms.key_arns["logs"]
  task_policy_statements  = lookup(local.task_policies, each.key, [])
  min_count               = each.value.min
  max_count               = each.value.max
  request_count_target    = each.value.request_target
  alb_arn_suffix          = module.edge.alb_arn_suffix
  namespace_id            = module.cluster.namespace_id
  enable_execute_command  = var.enable_execute_command
  log_retention_days      = var.log_retention_days
  use_spot                = var.environment == "dev"
  blue_green              = each.value.blue_green
  blue_green_listener_arn = each.value.blue_green ? module.edge.internal_listener_arn : null
  blue_green_alarm_names  = each.value.blue_green ? [module.observability.ledger_imbalance_alarm_name, module.observability.alb_5xx_alarm_name] : []
  listener_rules = concat(
    [for rule in each.value.public_rules : { listener_arn = module.edge.https_listener_arn, priority = rule.priority, path_patterns = rule.path_patterns, host_headers = [] }],
    each.value.internal ? [{ listener_arn = module.edge.internal_listener_arn, priority = 100 + index(local.internal_names, each.key), path_patterns = [], host_headers = ["${each.key}.${module.edge.internal_zone_name}"] }] : [],
  )
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
  target_group_arn_suffixes = {
    for name, definition in local.services : name => {
      load_balancer_suffix = length(definition.public_rules) > 0 ? module.edge.alb_arn_suffix : module.edge.internal_alb_arn_suffix
      target_group_suffix  = module.service[name].target_group_arn_suffix
    }
  }
}
