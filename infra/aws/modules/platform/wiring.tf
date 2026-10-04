locals {
  grpc_address = {
    go-money    = "go-money.${module.cluster.namespace_name}:9103"
    go-identity = "go-identity.${module.cluster.namespace_name}:9101"
  }

  internal_wiring_environment = {
    go-identity = {
      AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS = ":9101"
      USERS_MONEY_INTERNAL_URL            = local.internal_url["go-money"]
      USERS_ENTITLEMENT_EVENTS_QUEUE      = "identity-domain-events"
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
      LIVE_SAFETY_FRAMES_S3_BUCKET            = module.storage.media_bucket.id
      LIVE_SAFETY_FRAMES_S3_REGION            = var.region
      LIVE_SAFETY_EVIDENCE_S3_BUCKET          = module.storage.kyc_bucket.id
      LIVE_SAFETY_EVIDENCE_KMS_KEY_ID         = module.kms.key_arns["kyc"]
    }
    social = {
      COMMERCE_INTERNAL_URL      = local.internal_url["go-commerce"]
      LIVE_INTERNAL_URL          = local.internal_url["go-live"]
      MONEY_INTERNAL_URL         = local.internal_url["go-money"]
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
    }
    media = {
      MODERATION_URL = local.internal_url["intelligence"]
    }
    intelligence = {
      INTELLIGENCE_DOMAIN_EVENTS_QUEUE        = "intelligence-domain-events"
      INTELLIGENCE_TRUST_ADVISORY_QUEUE       = "intelligence-trust-advisory"
      INTELLIGENCE_TRUST_CONTENT_SCORES_QUEUE = "intelligence-trust-content-scores"
      INTELLIGENCE_TRUST_LIVE_SAFETY_QUEUE    = "intelligence-trust-live-safety"
      INTELLIGENCE_LIVE_SAFETY_FRAMES_QUEUE   = "jobs-live-frames"
      INTELLIGENCE_LIVE_SAFETY_AUDIO_QUEUE    = "jobs-live-audio"
      INTELLIGENCE_LIVE_SAFETY_REKOGNITION    = "enabled"
      INTELLIGENCE_LIVE_SAFETY_AWS_REGION     = var.region
    }
  }
}
