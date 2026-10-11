environment          = "prod"
region               = "eu-west-1"
dr_region            = "eu-central-1"
zone_name            = "zudomart.com"
create_zone          = true
app_domain           = "zudomart.com"
mail_domain          = "mail.zudomart.com"
dmarc_report_address = "dmarc@zudomart.com"
github_repository    = "zudomart/zudomart"
vpc_cidr             = "10.30.0.0/16"
nat_per_az           = true
enable_dr            = true
deletion_protection  = true
min_tasks            = 2
max_tasks_cap        = 20
log_retention_days   = 365
livekit_mode         = "cloud"
app_origins = {
  web    = "https://zudomart.com"
  webapp = "https://app.zudomart.com"
  seller = "https://seller.zudomart.com"
  studio = "https://studio.zudomart.com"
  admin  = "https://admin.zudomart.com"
  ads    = "https://ads.zudomart.com"
  gift   = "https://gift.zudomart.com"
}
aurora              = { instance_class = "db.r7g.xlarge", reader_count = 2, backup_retention_days = 35, engine_version = "17.4" }
valkey              = { node_type = "cache.r7g.large", node_count = 3 }
intelligence_valkey = { node_type = "cache.t4g.small", node_count = 2 }
mq                  = { deployment_mode = "CLUSTER_MULTI_AZ", instance_type = "mq.m7g.large" }

# Staging account id: images are promoted from the staging registry.
promotion_source_account_id = ""
