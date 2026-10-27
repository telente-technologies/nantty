environment          = "staging"
region               = "eu-west-1"
zone_name            = "staging.nantty.com"
create_zone          = true
app_domain           = "staging.nantty.com"
mail_domain          = "staging.nantty.com"
dmarc_report_address = "dmarc@nantty.com"
github_repository    = "nantty/nantty"
vpc_cidr             = "10.20.0.0/16"
nat_per_az           = true
enable_dr            = false
deletion_protection  = true
min_tasks            = 2
max_tasks_cap        = 6
log_retention_days   = 60
app_origins = {
  web    = "https://staging.nantty.com"
  webapp = "https://app.staging.nantty.com"
  seller = "https://seller.staging.nantty.com"
  studio = "https://studio.staging.nantty.com"
  admin  = "https://admin.staging.nantty.com"
  ads    = "https://ads.staging.nantty.com"
  gift   = "https://gift.staging.nantty.com"
}
aurora              = { instance_class = "db.r7g.large", reader_count = 1, backup_retention_days = 14, engine_version = "17.4" }
valkey              = { node_type = "cache.t4g.medium", node_count = 2 }
intelligence_valkey = { node_type = "cache.t4g.small", node_count = 1 }
mq                  = { deployment_mode = "SINGLE_INSTANCE", instance_type = "mq.m7g.medium" }

# Production account id, so prod can pull promoted images from this registry.
ecr_pull_account_ids = []
