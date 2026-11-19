locals {
  grpc_address = {
    go-money    = "127.0.0.1:29103"
    go-identity = "127.0.0.1:29101"
  }

  internal_wiring_environment = {
    gateway = {
      HUMAN_VERIFICATION_PROVIDER  = "turnstile"
      HUMAN_VERIFICATION_HOSTNAMES = join(",", [for origin in values(var.app_origins) : replace(replace(origin, "https://", ""), "http://", "")])
    }
    go-identity = {
      AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS      = "127.0.0.1:9101"
      USERS_MONEY_INTERNAL_URL                 = local.internal_url["go-money"]
      USERS_ENTITLEMENT_EVENTS_QUEUE           = "identity-domain-events"
      INTELLIGENCE_URL                         = local.internal_url["intelligence"]
      SMILE_ID_ENVIRONMENT                     = var.environment == "prod" ? "production" : "sandbox"
      SMILE_ID_ENABLED_PRODUCTS                = join(",", var.smile_id_enabled_products)
      SMILE_ID_ENABLED_DOCUMENT_TYPES          = join(",", var.smile_id_enabled_document_types)
      SMILE_ID_ENABLED_ENHANCED_DOCUMENT_TYPES = join(",", var.smile_id_enabled_enhanced_document_types)
      SMILE_ID_ENABLED_ID_NUMBER_TYPES         = join(",", var.smile_id_enabled_id_number_types)
      SMILE_ID_CALLBACK_URL                    = "https://${local.api_domain}/api/v1/webhooks/smile-id"
      SMILE_ID_WEB_SDK_CALLBACK_URL            = "https://${local.api_domain}/api/v1/webhooks/smile-id/web-sdk"
      SMILE_ID_HOSTED_LINK_CALLBACK_URL        = "https://${local.api_domain}/api/v1/webhooks/smile-id/hosted-link"
      WEB_APP_BASE_URL                         = var.app_origins["webapp"]
      USERS_SOCIAL_INTERNAL_URL                = local.internal_url["social"]
      USERS_LIVE_INTERNAL_URL                  = local.internal_url["go-live"]
    }
    go-money = {
      ESCROW_FEE_BPS               = "0"
      ESCROW_FEE_BUSINESS_PLAN_BPS = "0"
      SOCIAL_INTERNAL_URL          = local.internal_url["social"]
      ADMIN_INTERNAL_URL           = local.internal_url["go-identity"]
      PAYMENT_RETURN_URLS          = join(",", ["${var.app_origins["web"]}/pay/return", "${var.app_origins["webapp"]}/pay/return", "${var.app_origins["webapp"]}/settings/verification"])
    }
    go-commerce = {
      ORDERS_MONEY_GRPC_ADDRESS    = local.grpc_address["go-money"]
      ORDERS_MONEY_INTERNAL_URL    = local.internal_url["go-money"]
      ORDERS_ADS_INTERNAL_URL      = local.internal_url["go-ads"]
      ADMIN_INTERNAL_URL           = local.internal_url["go-identity"]
      SELLER_PLAN_ENTITLEMENTS_URL = local.internal_url["go-money"]
      CATALOG_SOCIAL_INTERNAL_URL  = local.internal_url["social"]
      CATALOG_ADS_INTERNAL_URL     = local.internal_url["go-ads"]
      ORDERS_EVENTS_QUEUE          = "commerce-domain-events"
      CATALOG_EVENTS_QUEUE         = "catalog-domain-events"
      MEDIA_INTERNAL_URL           = local.internal_url["media"]
      ORDERS_SOCIAL_INTERNAL_URL   = local.internal_url["social"]
    }
    go-live = {
      LIVE_MONEY_GRPC_ADDRESS             = local.grpc_address["go-money"]
      LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS = local.grpc_address["go-identity"]
      LIVE_CATALOG_INTERNAL_URL           = local.internal_url["go-commerce"]
      LIVE_EVENTS_QUEUE                   = "live-domain-events"
      ADMIN_INTERNAL_URL                  = local.internal_url["go-identity"]
    }
    go-ads = {
      SOCIAL_INTERNAL_URL    = local.internal_url["social"]
      COMMERCE_INTERNAL_URL  = local.internal_url["go-commerce"]
      ADS_MONEY_GRPC_ADDRESS = local.grpc_address["go-money"]
      ADS_MONEY_HTTP_URL     = local.internal_url["go-money"]
      INTELLIGENCE_URL       = local.internal_url["intelligence"]
      ADS_REPORT_QUEUE_NAME  = "jobs-ads-reports"
      ADS_ASSETS_BUCKET      = module.storage.media_bucket.id
      ADS_STAFF_JWKS_URL     = "${local.internal_url["go-identity"]}/.well-known/jwks.json"
      ADS_STAFF_TOKEN_ISSUER = "https://${local.api_domain}"
      IDENTITY_INTERNAL_URL  = local.internal_url["go-identity"]
      ADMIN_INTERNAL_URL     = local.internal_url["go-identity"]
      ADS_PUBLIC_URL         = "https://${local.api_domain}"
      ADS_APP_URL            = try(var.app_origins["ads"], "https://ads.${var.app_domain}")
      ADS_VERIFY_URL         = "${try(var.app_origins["web"], "https://${var.app_domain}")}/wallet/payouts"
    }
    go-trust = {
      MODERATION_USERS_INTERNAL_URL           = local.internal_url["go-identity"]
      ADMIN_INTERNAL_URL                      = local.internal_url["go-identity"]
      MODERATION_SOCIAL_INTERNAL_URL          = local.internal_url["social"]
      MODERATION_COMMERCE_INTERNAL_URL        = local.internal_url["go-commerce"]
      MODERATION_LIVE_INTERNAL_URL            = local.internal_url["go-live"]
      MODERATION_REPORT_EVENTS_QUEUE          = "trust-domain-events"
      INTELLIGENCE_URL                        = local.internal_url["intelligence"]
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
      MEDIA_INTERNAL_URL         = local.internal_url["media"]
      ADS_INTERNAL_URL           = local.internal_url["go-ads"]
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
    realtime = {
      SOCIAL_INTERNAL_URL = local.internal_url["social"]
      LIVE_INTERNAL_URL   = local.internal_url["go-live"]
      REALTIME_QUEUE_NAME = "realtime-domain-events"
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
