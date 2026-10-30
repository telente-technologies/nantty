environment          = "dev"
region               = "eu-west-1"
zone_name            = "dev.nantty.com"
create_zone          = true
app_domain           = "dev.nantty.com"
mail_domain          = "dev.nantty.com"
dmarc_report_address = "dmarc@nantty.com"
github_repository    = "nantty/nantty"
vpc_cidr             = "10.10.0.0/16"
nat_per_az           = true
enable_dr            = false
deletion_protection  = false
min_tasks            = 1
max_tasks_cap        = 3
log_retention_days   = 30
app_origins = {
  web    = "https://dev.nantty.com"
  webapp = "https://app.dev.nantty.com"
  seller = "https://seller.dev.nantty.com"
  studio = "https://studio.dev.nantty.com"
  admin  = "https://admin.dev.nantty.com"
  ads    = "https://ads.dev.nantty.com"
}
aurora              = { instance_class = "db.t4g.medium", reader_count = 0, backup_retention_days = 7, engine_version = "17.4" }
valkey              = { node_type = "cache.t4g.small", node_count = 1 }
intelligence_valkey = { node_type = "cache.t4g.micro", node_count = 1 }
mq                  = { deployment_mode = "SINGLE_INSTANCE", instance_type = "mq.m7g.medium" }
