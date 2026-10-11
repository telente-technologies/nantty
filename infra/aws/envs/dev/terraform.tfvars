environment          = "dev"
region               = "eu-west-1"
zone_name            = "dev.zudomart.com"
create_zone          = true
app_domain           = "dev.zudomart.com"
mail_domain          = "dev.zudomart.com"
dmarc_report_address = "dmarc@zudomart.com"
github_repository    = "zudomart/zudomart"
vpc_cidr             = "10.10.0.0/16"
nat_per_az           = true
enable_dr            = false
deletion_protection  = false
min_tasks            = 1
max_tasks_cap        = 3
log_retention_days   = 30
app_origins = {
  web    = "https://dev.zudomart.com"
  webapp = "https://app.dev.zudomart.com"
  seller = "https://seller.dev.zudomart.com"
  studio = "https://studio.dev.zudomart.com"
  admin  = "https://admin.dev.zudomart.com"
  ads    = "https://ads.dev.zudomart.com"
  gift   = "https://gift.dev.zudomart.com"
}
aurora              = { instance_class = "db.t4g.medium", reader_count = 0, backup_retention_days = 7, engine_version = "17.4" }
valkey              = { node_type = "cache.t4g.small", node_count = 1 }
intelligence_valkey = { node_type = "cache.t4g.micro", node_count = 1 }
mq                  = { deployment_mode = "SINGLE_INSTANCE", instance_type = "mq.m7g.medium" }
