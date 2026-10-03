locals {
  catalog = {
    gateway = {
      port         = 8080, cpu = 512, memory = 1024, health = "/healthz", database = false, rabbit = false, min = 2, max = 12
      public_rules = [{ priority = 100, path_patterns = ["/*"] }], internal = false, request_target = 1500
      secret_keys  = ["IDENTITY_INTERNAL_TOKEN"], valkey = true, node = true
    }
    go-identity = {
      port         = 8080, cpu = 512, memory = 1024, health = "/healthz", database = true, rabbit = true, min = 2, max = 8
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["AUTH_SIGNING_KEY_ENCRYPTION_KEY", "AUTH_ONE_TIME_CODE_PEPPER", "AUTH_OTP_EVENT_KEY", "USERS_MEDIA_UPLOAD_SIGNING_KEY", "USERS_INTERNAL_API_TOKEN", "ADMIN_TOTP_ENCRYPTION_KEY", "ADMIN_INTERNAL_API_TOKEN", "AUTH_INTERNAL_GRPC_TOKEN"]
    }
    go-commerce = {
      port         = 8080, cpu = 512, memory = 1024, health = "/healthz", database = true, rabbit = true, min = 2, max = 10
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["CATALOG_INTERNAL_API_TOKEN", "ORDERS_MONEY_GRPC_TOKEN", "SELLER_PLAN_ENTITLEMENTS_TOKEN"]
    }
    go-money = {
      port         = 8080, cpu = 1024, memory = 2048, health = "/healthz", database = true, rabbit = true, min = 2, max = 8, extra_ports = [9103]
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false, blue_green = true
      secret_keys  = ["PAYSTACK_SECRET_KEY", "MONEY_INTERNAL_GRPC_TOKEN", "MONEY_INTERNAL_API_TOKEN", "DATA_ENCRYPTION_KEY"]
    }
    go-live = {
      port         = 8080, cpu = 1024, memory = 2048, health = "/healthz", database = true, rabbit = true, min = 2, max = 10
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["LIVE_INTERNAL_API_TOKEN", "LIVE_MONEY_GRPC_TOKEN", "LIVE_ACCOUNT_DIRECTORY_GRPC_TOKEN"]
    }
    go-ads = {
      port         = 8080, cpu = 512, memory = 1024, health = "/healthz", database = true, rabbit = true, min = 2, max = 6
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["ADS_INTERNAL_API_TOKEN"]
    }
    go-trust = {
      port         = 8080, cpu = 512, memory = 1024, health = "/healthz", database = true, rabbit = true, min = 2, max = 6
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["MODERATION_INTERNAL_API_TOKEN"]
    }
    social = {
      port         = 8105, cpu = 1024, memory = 2048, health = "/healthz", database = true, rabbit = true, min = 2, max = 12
      public_rules = [], internal = true, request_target = 0, valkey = true, node = true
      secret_keys  = ["SOCIAL_INTERNAL_TOKEN", "COMMERCE_INTERNAL_TOKEN", "LIVE_INTERNAL_TOKEN", "MONEY_INTERNAL_TOKEN"]
    }
    notifications = {
      port         = 8104, cpu = 512, memory = 1024, health = "/healthz", database = true, rabbit = true, min = 2, max = 6
      public_rules = [], internal = true, request_target = 0, valkey = true, node = true
      secret_keys  = ["IDENTITY_INTERNAL_TOKEN", "UNSUBSCRIBE_SIGNING_SECRET", "SOCIAL_INTERNAL_TOKEN", "AUTH_OTP_EVENT_KEY"]
    }
    media = {
      port         = 8108, cpu = 1024, memory = 2048, health = "/healthz", database = true, rabbit = true, min = 2, max = 8
      public_rules = [], internal = true, request_target = 0, valkey = true, node = true
      secret_keys  = ["MEDIA_INTERNAL_TOKEN"]
    }
    realtime = {
      port         = 4000, cpu = 1024, memory = 2048, health = "/healthz", database = false, rabbit = true, min = 2, max = 10
      public_rules = [{ priority = 20, path_patterns = ["/ws*"] }], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["SECRET_KEY_BASE"]
    }
    intelligence = {
      port         = 8090, cpu = 1024, memory = 4096, health = "/health/live", database = true, rabbit = true, min = 1, max = 6
      public_rules = [], internal = true, request_target = 0, valkey = true, node = false
      secret_keys  = ["INTELLIGENCE_SHARED_SECRET", "INTELLIGENCE_MODEL_SIGNING_SECRET"]
    }
  }

  python_services = ["intelligence"]
  node_services   = [for name, definition in local.catalog : name if definition.node]

  services = {
    for name, definition in local.catalog : name => merge(definition, {
      min        = max(1, min(try(var.service_overrides[name].min, var.min_tasks), try(var.service_overrides[name].max, definition.max)))
      max        = min(try(var.service_overrides[name].max, definition.max), var.max_tasks_cap)
      cpu        = try(var.service_overrides[name].cpu, definition.cpu)
      memory     = try(var.service_overrides[name].memory, definition.memory)
      extra      = try(definition.extra_ports, [])
      blue_green = try(definition.blue_green, false)
      health_command = (
        contains(local.node_services, name) ? ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:${definition.port}${definition.health} || exit 1"] :
        contains(local.python_services, name) ? ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:${definition.port}${definition.health}', timeout=2).status == 200 else 1)"] :
        null
      )
    })
  }

  database_roles = { for name, definition in local.services : name => "svc_${replace(name, "go-", "")}" if definition.database }
  rabbit_users   = [for name, definition in local.services : name if definition.rabbit]
  internal_names = [for name, definition in local.services : name if definition.internal]

  gateway_cors = { for key, origin in var.app_origins : "CORS_ORIGIN_${upper(key)}" => origin }
  internal_url = { for name in local.internal_names : name => "http://${name}.${module.edge.internal_zone_name}" }
}
