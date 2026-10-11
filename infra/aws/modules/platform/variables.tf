variable "environment" {
  description = "dev, staging or prod."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}
variable "region" { type = string }
variable "dr_region" {
  type    = string
  default = "eu-central-1"
}
variable "enable_dr" {
  description = "Cross-region backups, S3 replication, ECR replication and secret replicas."
  type        = bool
  default     = false
}
variable "zone_name" {
  description = "Public Route 53 zone, for example zudomart.com."
  type        = string
}
variable "create_zone" {
  type    = bool
  default = false
}
variable "app_domain" {
  description = "Domain for this environment, for example staging.zudomart.com (api., media. and livekit. are prefixed)."
  type        = string
}
variable "mail_domain" {
  description = "Verified SES sending domain."
  type        = string
}
variable "vpc_cidr" { type = string }
variable "az_count" {
  type    = number
  default = 3
}
variable "nat_per_az" {
  type    = bool
  default = false
}
variable "alarm_email" {
  type    = string
  default = ""
}
variable "dmarc_report_address" { type = string }
variable "github_repository" {
  description = "GitHub owner/name that may deploy to this account."
  type        = string
}
variable "create_github_oidc_provider" {
  type    = bool
  default = true
}
variable "app_origins" {
  description = "Exact browser origins per frontend, used for gateway CORS and S3 upload CORS."
  type        = map(string)
}
variable "image_tag" {
  description = "Initial image tag; CI registers new task definitions afterwards (Terraform ignores them)."
  type        = string
  default     = "bootstrap"
}
variable "min_tasks" {
  type    = number
  default = 2
}
variable "max_tasks_cap" {
  type    = number
  default = 10
}
variable "service_overrides" {
  description = "Per-service overrides: cpu, memory, min, max."
  type        = map(map(number))
  default     = {}
}
variable "aurora" {
  type = object({
    instance_class        = string
    reader_count          = number
    backup_retention_days = number
    engine_version        = string
  })
}
variable "valkey" {
  type = object({
    node_type  = string
    node_count = number
  })
}
variable "mq" {
  type = object({
    deployment_mode = string
    instance_type   = string
  })
}
variable "livekit_mode" {
  type    = string
  default = "cloud"
}
variable "livekit_node_count" {
  type    = number
  default = 2
}
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "log_retention_days" {
  type    = number
  default = 90
}
variable "enable_execute_command" {
  type    = bool
  default = false
}
variable "media_signing_public_key_pem" {
  type    = string
  default = null
}
variable "ecr_pull_account_ids" {
  description = "Accounts that may pull this account's images (prod account id on staging)."
  type        = list(string)
  default     = []
}
variable "promotion_source_account_id" {
  description = "Account to pull promoted images from (staging account id on prod)."
  type        = string
  default     = ""
}
variable "cdn_rate_limit_per_five_minutes" {
  description = "Per-IP request limit (5-minute window) on the media CloudFront WAF."
  type        = number
  default     = 10000
}
variable "intelligence_valkey" {
  description = "Dedicated Valkey for the intelligence service (TLS + AUTH, reachable from the intelligence task only)."
  type = object({
    node_type  = string
    node_count = number
  })
  default = { node_type = "cache.t4g.small", node_count = 1 }
}
variable "payments_internet_egress_cidrs" {
  description = "Internet ranges go-money may reach on 443 (Flutterwave, Apple, Google). Narrow once the providers' ranges are confirmed; hostnames cannot be expressed in a security group."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
