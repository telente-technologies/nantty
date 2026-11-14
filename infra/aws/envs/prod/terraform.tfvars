environment          = "prod"
region               = "eu-west-1"
dr_region            = "eu-central-1"
zone_name            = "nantty.com"
cloudflare_zone_id   = "86f9662e6a4f44a2d8abd0c8c2d85c99"
create_zone          = true
app_domain           = "nantty.com"
mail_domain          = "mail.nantty.com"
dmarc_report_address = "dmarc@nantty.com"
github_repository    = "nantty/nantty"
vpc_cidr             = "10.30.0.0/16"
nat_per_az           = true
enable_dr            = true
deletion_protection  = true
min_tasks            = 2
max_tasks_cap        = 20
log_retention_days   = 365
livekit_mode         = "cloud"
app_origins = {
  web    = "https://nantty.com"
  webapp = "https://app.nantty.com"
  seller = "https://seller.nantty.com"
  studio = "https://studio.nantty.com"
  admin  = "https://admin.nantty.com"
  ads    = "https://ads.nantty.com"
}

# Required before the production environment can be applied. Use your team's fixed egress CIDR(s), never 0.0.0.0/0.
# admin_ip_allow_list = ["203.0.113.10/32"]
aurora              = { instance_class = "db.r7g.xlarge", reader_count = 2, backup_retention_days = 35, engine_version = "17.4" }
valkey              = { node_type = "cache.r7g.large", node_count = 3 }
intelligence_valkey = { node_type = "cache.t4g.small", node_count = 2 }
mq                  = { deployment_mode = "CLUSTER_MULTI_AZ", instance_type = "mq.m7g.large" }

# Staging account id: images are promoted from the staging registry.
promotion_source_account_id = ""
