locals {
  grpc_address = {
    go-money    = "go-money.${module.cluster.namespace_name}:9103"
    go-identity = "go-identity.${module.cluster.namespace_name}:9101"
  }

  internal_wiring_environment = {
    gateway = {
      HUMAN_VERIFICATION_PROVIDER  = "turnstile"
      HUMAN_VERIFICATION_HOSTNAMES = join(",", [for origin in values(var.app_origins) : replace(replace(origin, "https://", ""), "http://", "")])
    }
    go-identity = {
      AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS = ":9101"
      USERS_MONEY_INTERNAL_URL            = local.internal_url["go-money"]
      USERS_ENTITLEMENT_EVENTS_QUEUE      = "identity-domain-events"
      INTELLIGENCE_URL                    = local.internal_url["intelligence"]
      SMILE_ID_ENVIRONMENT                = var.environment == "prod" ? "production" : "sandbox"
      SMILE_ID_CALLBACK_URL               = "https://${local.api_domain}/api/v1/webhooks/smile-id"
      WEB_APP_BASE_URL                    = var.app_origins["webapp"]
    }
    go-money = {
      PAYMENT_RETURN_URLS = join(",", ["${var.app_origins["web"]}/pay/return", "${var.app_origins["webapp"]}/pay/return", "${var.app_origins["webapp"]}/settings/verification"])
    }
    go-commerce = {
      ORDERS_MONEY_GRPC_ADDRESS    = local.grpc_address["go-money"]
      ORDERS_MONEY_INTERNAL_URL    = local.internal_url["go-money"]
      SELLER_PLAN_ENTITLEMENTS_URL = local.internal_url["go-money"]
      CATALOG_SOCIAL_INTERNAL_URL  = local.internal_url["social"]
      ORDERS_EVENTS_QUEUE          = "commerce-domain-events"
      CATALOG_EVENTS_QUEUE         = "catalog-domain-events"
    }
    go-live = {
      LIVE_MONEY_GRPC_ADDRESS             = local.grpc_address["go-money"]
      LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS = local.grpc_address["go-identity"]
      LIVE_EVENTS_QUEUE                   = "live-domain-events"
    }
    go-ads = {
      SOCIAL_INTERNAL_URL    = local.internal_url["social"]
      COMMERCE_INTERNAL_URL  = local.internal_url["go-commerce"]
      ADS_MONEY_GRPC_ADDRESS = local.grpc_address["go-money"]
      ADS_MONEY_HTTP_URL     = local.internal_url["go-money"]
      INTELLIGENCE_URL       = local.internal_url["intelligence"]
      ADS_REPORT_QUEUE_NAME  = "jobs-ads-reports"
    }
    go-trust = {
      MODERATION_USERS_INTERNAL_URL           = local.internal_url["go-identity"]
      MODERATION_SOCIAL_INTERNAL_URL          = local.internal_url["social"]
      MODERATION_COMMERCE_INTERNAL_URL        = local.internal_url["go-commerce"]
      MODERATION_LIVE_INTERNAL_URL            = local.internal_url["go-live"]
      MODERATION_REPORT_EVENTS_QUEUE          = "trust-domain-events"
      INTELLIGENCE_TRUST_ADVISORY_QUEUE       = "intelligence-trust-advisory"
      INTELLIGENCE_TRUST_CONTENT_SCORES_QUEUE = "intelligence-trust-content-scores"
      INTELLIGENCE_TRUST_LIVE_SAFETY_QUEUE    = "intelligence-trust-live-safety"
      INTELLIGENCE_TRUST_BOT_SCORES_QUEUE     = "intelligence-trust-bot-scores"
      LIVE_SAFETY_FRAMES_S3_BUCKET            = module.storage.media_bucket.id
      LIVE_SAFETY_FRAMES_S3_REGION            = var.region
      LIVE_SAFETY_EVIDENCE_S3_BUCKET          = module.storage.kyc_bucket.id
      LIVE_SAFETY_EVIDENCE_KMS_KEY_ID         = module.kms.key_arns["kyc"]
    }
    social = {
      COMMERCE_INTERNAL_URL      = local.internal_url["go-commerce"]
      LIVE_INTERNAL_URL          = local.internal_url["go-live"]
      MONEY_INTERNAL_URL         = local.internal_url["go-money"]
      ADMIN_INTERNAL_URL         = local.internal_url["go-identity"]
      INTELLIGENCE_URL           = local.internal_url["intelligence"]
      FEED_RANK_TIMEOUT_MS       = "250"
      SOCIAL_DOMAIN_EVENTS_QUEUE = "social-domain-events"
    }
    search = {
      PORT                       = "8109"
      IDENTITY_INTERNAL_URL      = local.internal_url["go-identity"]
      COMMERCE_INTERNAL_URL      = local.internal_url["go-commerce"]
      SOCIAL_INTERNAL_URL        = local.internal_url["social"]
      INTELLIGENCE_URL           = local.internal_url["intelligence"]
      SEARCH_DOMAIN_EVENTS_QUEUE = "search-domain-events"
    }
    notifications = {
      SOCIAL_INTERNAL_URL = local.internal_url["social"]
      ADMIN_WEB_BASE_URL  = try(var.app_origins["admin"], "https://admin.${var.app_domain}")
    }
    support = {
      IDENTITY_INTERNAL_URL       = local.internal_url["go-identity"]
      INTELLIGENCE_URL            = local.internal_url["intelligence"]
      MEDIA_INTERNAL_URL          = local.internal_url["media"]
      SUPPORT_DOMAIN_EVENTS_QUEUE = "support-domain-events"
      WEB_BASE_URL                = try(var.app_origins["webapp"], "https://app.${var.app_domain}")
    }
    media = {
      MODERATION_URL = local.internal_url["intelligence"]
    }
    intelligence = {
      INTELLIGENCE_SERVER_WORKERS             = "2"
      INTELLIGENCE_MEDIA_BUCKET               = module.storage.media_bucket.id
      INTELLIGENCE_DOMAIN_EVENTS_QUEUE        = "intelligence-domain-events"
      INTELLIGENCE_TRUST_ADVISORY_QUEUE       = "intelligence-trust-advisory"
      INTELLIGENCE_TRUST_CONTENT_SCORES_QUEUE = "intelligence-trust-content-scores"
      INTELLIGENCE_TRUST_LIVE_SAFETY_QUEUE    = "intelligence-trust-live-safety"
      INTELLIGENCE_TRUST_BOT_SCORES_QUEUE     = "intelligence-trust-bot-scores"
      INTELLIGENCE_LIVE_SAFETY_FRAMES_QUEUE   = "jobs-live-frames"
      INTELLIGENCE_LIVE_SAFETY_AUDIO_QUEUE    = "jobs-live-audio"
      INTELLIGENCE_LIVE_SAFETY_REKOGNITION    = "enabled"
      INTELLIGENCE_LIVE_SAFETY_AWS_REGION     = var.region
    }
  }
}
