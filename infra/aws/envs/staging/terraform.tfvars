environment                   = "staging"
region                        = "eu-north-1"
zone_name                     = "staging.nantty.com"
cloudflare_zone_id            = "86f9662e6a4f44a2d8abd0c8c2d85c99"
create_zone                   = false
app_domain                    = "staging.nantty.com"
mail_domain                   = "staging.nantty.com"
dmarc_report_address          = "dmarc@nantty.com"
github_repository             = "nantty/nantty"
vpc_cidr                      = "10.20.0.0/16"
nat_per_az                    = true
dr_region                     = "eu-north-1"
enable_dr                     = false
deletion_protection           = true
min_tasks                     = 2
max_tasks_cap                 = 6
enable_media_malware_scanning = true
service_overrides = {
  media = { min = 1, max = 2 }
}
log_retention_days = 60
app_origins = {
  web    = "https://staging.nantty.com"
  webapp = "https://app.staging.nantty.com"
  seller = "https://seller.staging.nantty.com"
  studio = "https://studio.staging.nantty.com"
  admin  = "https://admin.staging.nantty.com"
  ads    = "https://ads.staging.nantty.com"
}

# Required before the staging environment can be applied. Use your team's fixed egress CIDR(s), never 0.0.0.0/0.
# admin_ip_allow_list = ["203.0.113.10/32"]
aurora              = { instance_class = "db.r7g.large", reader_count = 1, backup_retention_days = 14, engine_version = "17.4" }
valkey              = { node_type = "cache.t4g.medium", node_count = 2 }
intelligence_valkey = { node_type = "cache.t4g.small", node_count = 1 }
mq                  = { deployment_mode = "SINGLE_INSTANCE", instance_type = "mq.m7g.medium" }

# Production account id, so prod can pull promoted images from this registry.
ecr_pull_account_ids = []
