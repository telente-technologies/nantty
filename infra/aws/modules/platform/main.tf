data "aws_caller_identity" "current" {}

locals {
  api_domain     = "api.${var.app_domain}"
  media_domain   = "media.${var.app_domain}"
  livekit_domain = "livekit.${var.app_domain}"
  tags_prefix    = "nantty-${var.environment}"
  service_names  = keys(local.services)
}

module "kms" {
  source             = "../kms"
  environment        = var.environment
  key_user_role_arns = { kyc = [for name in local.kyc_key_users : local.task_role_arn[name]] }
}

module "kms_dr" {
  source      = "../kms"
  count       = var.enable_dr ? 1 : 0
  environment = "${var.environment}-dr"
  providers   = { aws = aws.dr }
}

module "cloudfront_waf" {
  source                      = "../cloudfront-waf"
  environment                 = var.environment
  rate_limit_per_five_minutes = var.cdn_rate_limit_per_five_minutes
  log_retention_days          = var.log_retention_days
  providers                   = { aws = aws.us_east_1 }
}

module "storage" {
  source                       = "../storage"
  environment                  = var.environment
  media_domain                 = local.media_domain
  media_certificate_arn        = module.dns.media_certificate_arn
  web_acl_arn                  = module.cloudfront_waf.web_acl_arn
  kyc_kms_key_arn              = module.kms.key_arns["kyc"]
  kyc_dr_kms_key_arn           = var.enable_dr ? module.kms_dr[0].key_arns["kyc"] : null
  media_key_user_role_arns     = [for name in local.media_key_users : local.task_role_arn[name]]
  enable_dr                    = var.enable_dr
  dr_region                    = var.dr_region
  upload_cors_origins          = values(var.app_origins)
  media_signing_public_key_pem = var.media_signing_public_key_pem
  providers                    = { aws = aws, aws.dr = aws.dr }
}

module "network" {
  source              = "../network"
  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  az_count            = var.az_count
  nat_per_az          = var.nat_per_az
  flow_log_bucket_arn = "${module.storage.logs_bucket.arn}/vpc-flow"
}

resource "aws_security_group" "tasks" {
  name_prefix = "${local.tags_prefix}-tasks-"
  description = "Shared data-store client and outbound access; never grants service ingress"
  vpc_id      = module.network.vpc_id
  lifecycle {
    create_before_destroy = true
    precondition {
      condition     = var.environment == "dev" || length(var.admin_ip_allow_list) > 0
      error_message = "admin_ip_allow_list must contain a trusted CIDR for staging and prod."
    }
  }
}

resource "aws_security_group_rule" "tasks_from_public_alb" {
  for_each                 = { for name, definition in local.services : name => definition if length(definition.public_rules) > 0 }
  type                     = "ingress"
  description              = "Public ALB to tasks"
  from_port                = 18443
  to_port                  = 18443
  protocol                 = "tcp"
  security_group_id        = aws_security_group.service[each.key].id
  source_security_group_id = module.edge.alb_security_group_id
}

module "dns" {
  source             = "../dns"
  zone_name          = var.zone_name
  create_zone        = var.create_zone
  cloudflare_zone_id = var.cloudflare_zone_id
  api_domain         = local.api_domain
  media_domain       = local.media_domain
  extra_api_domains  = var.livekit_mode == "self_hosted" ? [local.livekit_domain] : []
  providers          = { aws = aws, aws.us_east_1 = aws.us_east_1, cloudflare = cloudflare }
}

data "cloudflare_ip_ranges" "edge" {}

module "edge" {
  source                       = "../edge"
  environment                  = var.environment
  vpc_id                       = module.network.vpc_id
  vpc_cidr                     = var.vpc_cidr
  public_subnet_ids            = module.network.public_subnet_ids
  certificate_arn              = module.dns.api_certificate_arn
  logs_bucket_id               = module.storage.logs_bucket.id
  logs_kms_key_arn             = module.kms.key_arns["logs"]
  cloudflare_ipv4_cidrs        = data.cloudflare_ip_ranges.edge.ipv4_cidrs
  cloudflare_ipv6_cidrs        = data.cloudflare_ip_ranges.edge.ipv6_cidrs
  smile_id_callback_ipv4_cidrs = var.environment == "prod" ? var.smile_id_production_callback_ipv4_cidrs : var.smile_id_sandbox_callback_ipv4_cidrs
  deletion_protection          = var.deletion_protection
  log_retention_days           = var.log_retention_days
}

module "ecr" {
  source              = "../ecr"
  repositories        = concat(local.service_names, ["migrate", "tls-proxy"])
  kms_key_arn         = module.kms.key_arns["ecr"]
  replicate_to_region = var.enable_dr ? var.dr_region : null
  pull_account_ids    = var.ecr_pull_account_ids
}

module "cluster" {
  source             = "../ecs-cluster"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  logs_kms_key_arn   = module.kms.key_arns["logs"]
  log_retention_days = var.log_retention_days
}

module "aurora" {
  source                     = "../aurora"
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  data_subnet_ids            = module.network.data_subnet_ids
  tasks_security_group_id    = aws_security_group.tasks.id
  data_kms_key_arn           = module.kms.key_arns["data"]
  secrets_kms_key_arn        = module.kms.key_arns["secrets"]
  backup_kms_key_arn         = module.kms.key_arns["backup"]
  dr_backup_kms_key_arn      = var.enable_dr ? module.kms_dr[0].key_arns["backup"] : null
  engine_version             = var.aurora.engine_version
  instance_class             = var.aurora.instance_class
  reader_count               = var.aurora.reader_count
  backup_retention_days      = var.aurora.backup_retention_days
  deletion_protection        = var.deletion_protection
  enable_dr                  = var.enable_dr
  service_database_roles     = concat(values(local.database_roles), ["svc_migrator"])
  payments_security_group_id = aws_security_group.payments.id
  providers                  = { aws = aws, aws.dr = aws.dr }
}

module "valkey" {
  source                     = "../valkey"
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  data_subnet_ids            = module.network.data_subnet_ids
  client_security_group_ids  = [aws_security_group.tasks.id]
  payments_security_group_id = aws_security_group.payments.id
  data_kms_key_arn           = module.kms.key_arns["data"]
  secrets_kms_key_arn        = module.kms.key_arns["secrets"]
  logs_kms_key_arn           = module.kms.key_arns["logs"]
  node_type                  = var.valkey.node_type
  node_count                 = var.valkey.node_count
}

module "messaging" {
  source                     = "../messaging"
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  tasks_security_group_id    = aws_security_group.tasks.id
  data_kms_key_arn           = module.kms.key_arns["data"]
  secrets_kms_key_arn        = module.kms.key_arns["secrets"]
  deployment_mode            = var.mq.deployment_mode
  instance_type              = var.mq.instance_type
  service_users              = local.rabbit_users
  payments_security_group_id = aws_security_group.payments.id
}

module "ses" {
  source               = "../ses"
  environment          = var.environment
  region               = var.region
  mail_domain          = var.mail_domain
  zone_id              = module.dns.zone_id
  sns_kms_key_id       = module.kms.key_ids["sns"]
  dmarc_report_address = var.dmarc_report_address
}

module "livekit" {
  source                = "../livekit"
  environment           = var.environment
  region                = var.region
  mode                  = var.livekit_mode
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  cluster_arn           = module.cluster.cluster_arn
  cluster_name          = module.cluster.cluster_name
  listener_arn          = module.edge.https_listener_arn
  alb_security_group_id = module.edge.alb_security_group_id
  host                  = local.livekit_domain
  webhook_url           = "https://${local.api_domain}/api/v1/live/webhooks/livekit"
  secrets_kms_key_arn   = module.kms.key_arns["secrets"]
  logs_kms_key_arn      = module.kms.key_arns["logs"]
  valkey_endpoint       = module.valkey.primary_endpoint
  valkey_auth_token     = module.valkey.auth_token
  node_count            = var.livekit_node_count
  log_retention_days    = var.log_retention_days
}

module "github_oidc" {
  source              = "../github-oidc"
  environment         = var.environment
  repository          = var.github_repository
  github_environment  = var.environment == "prod" ? "production" : var.environment
  create_provider     = var.create_github_oidc_provider
  ecr_repository_arns = module.ecr.repository_arns

  promotion_source_account_id = var.promotion_source_account_id
}
