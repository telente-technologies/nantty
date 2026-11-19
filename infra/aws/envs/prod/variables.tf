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
  description = "Public Route 53 zone, for example nantty.com."
  type        = string
}
variable "create_zone" {
  type    = bool
  default = false
}
variable "cloudflare_zone_id" {
  description = "Authoritative Cloudflare zone ID used for app and API DNS."
  type        = string
}
variable "app_domain" {
  description = "Domain for this environment, for example staging.nantty.com (api., media. and livekit. are prefixed)."
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
variable "smile_id_enabled_products" {
  description = "Smile ID products confirmed active for this partner account; leave empty until verified."
  type        = list(string)
  default     = []
}
variable "smile_id_enabled_document_types" {
  description = "Optional country:type restriction for Standard Document Verification; empty uses Smile's global supported-document catalog when the product is enabled."
  type        = list(string)
  default     = []
}
variable "smile_id_enabled_enhanced_document_types" {
  description = "Exact Enhanced Document Verification country:type pairs confirmed active in the partner account."
  type        = list(string)
  default     = []
}
variable "smile_id_enabled_id_number_types" {
  description = "Exact Smile ID ID-number country:type pairs confirmed active for the partner account."
  type        = list(string)
  default     = []
}
variable "admin_ip_allow_list" {
  description = "CIDR ranges permitted to reach admin routes through the gateway. Required for production."
  type        = list(string)
  default     = []
}
variable "blocked_client_ip_cidrs" {
  description = "Optional IPv4/IPv6 CIDRs to block at the API gateway; use /32 or /128 for one address."
  type        = list(string)
  default     = []
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
variable "intelligence_valkey" {
  type = object({
    node_type  = string
    node_count = number
  })
  default = { node_type = "cache.t4g.small", node_count = 1 }
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
