environment          = "staging"
region               = "eu-west-1"
zone_name            = "staging.zudomart.com"
create_zone          = true
app_domain           = "staging.zudomart.com"
mail_domain          = "staging.zudomart.com"
dmarc_report_address = "dmarc@zudomart.com"
github_repository    = "zudomart/zudomart"
vpc_cidr             = "10.20.0.0/16"
nat_per_az           = true
enable_dr            = false
deletion_protection  = true
min_tasks            = 2
max_tasks_cap        = 6
log_retention_days   = 60
app_origins = {
  web    = "https://staging.zudomart.com"
  webapp = "https://app.staging.zudomart.com"
  seller = "https://seller.staging.zudomart.com"
  studio = "https://studio.staging.zudomart.com"
  admin  = "https://admin.staging.zudomart.com"
  ads    = "https://ads.staging.zudomart.com"
  gift   = "https://gift.staging.zudomart.com"
}
aurora              = { instance_class = "db.r7g.large", reader_count = 1, backup_retention_days = 14, engine_version = "17.4" }
valkey              = { node_type = "cache.t4g.medium", node_count = 2 }
intelligence_valkey = { node_type = "cache.t4g.small", node_count = 1 }
mq                  = { deployment_mode = "SINGLE_INSTANCE", instance_type = "mq.m7g.medium" }

# Production account id, so prod can pull promoted images from this registry.
ecr_pull_account_ids = []
