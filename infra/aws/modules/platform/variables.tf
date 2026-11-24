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
  description = "ID of the authoritative Cloudflare zone that serves this environment's DNS names."
  type        = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_zone_id))
    error_message = "cloudflare_zone_id must be a 32-character hexadecimal zone ID."
  }
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
  description = "Smile ID products confirmed active for this partner account; empty disables identity capture options."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for product in var.smile_id_enabled_products : contains(["document_verification", "enhanced_document_verification", "enhanced_kyc"], product)])
    error_message = "Smile ID products must be confirmed supported V3 identifiers."
  }
}
variable "smile_id_enabled_document_types" {
  description = "Optional country:type restriction for Standard Document Verification; empty uses Smile's global supported-document catalog when that product is enabled."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for value in var.smile_id_enabled_document_types : can(regex("^[A-Za-z]{2}:[A-Za-z0-9_]+$", value))])
    error_message = "Photo document entries must use COUNTRY_CODE:ID_TYPE format, for example NG:PASSPORT."
  }
}
variable "smile_id_enabled_enhanced_document_types" {
  description = "Exact country:type pairs confirmed enabled for Enhanced Document Verification in the Smile partner account; empty disables this product."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for value in var.smile_id_enabled_enhanced_document_types : can(regex("^[A-Za-z]{2}:[A-Za-z0-9_]+$", value))])
    error_message = "Enhanced Document entries must use COUNTRY_CODE:ID_TYPE format."
  }
}
variable "smile_id_enabled_id_number_types" {
  description = "Exact country:type ID-number pairs confirmed active for this partner (for example NG:NIN_V2); empty disables ID-number choices."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for value in var.smile_id_enabled_id_number_types : can(regex("^[A-Za-z]{2}:[A-Za-z0-9_]+$", value))])
    error_message = "ID-number entries must use COUNTRY_CODE:ID_TYPE format, for example NG:NIN_V2."
  }
}
variable "smile_id_sandbox_callback_ipv4_cidrs" {
  description = "Smile ID's documented sandbox webhook source IPv4 addresses. Reconcile with provider docs before changes."
  type        = list(string)
  default     = ["13.48.228.158/32", "16.170.104.93/32", "54.246.37.255/32", "99.81.237.141/32"]
  validation {
    condition     = length(var.smile_id_sandbox_callback_ipv4_cidrs) > 0 && alltrue([for cidr in var.smile_id_sandbox_callback_ipv4_cidrs : can(cidrnetmask(cidr)) && endswith(cidr, "/32")])
    error_message = "Sandbox Smile ID callback addresses must be non-empty IPv4 /32 entries from the provider's current documentation."
  }
}
variable "smile_id_production_callback_ipv4_cidrs" {
  description = "Smile ID's documented production webhook source IPv4 addresses. Reconcile with provider docs before changes."
  type        = list(string)
  default     = ["13.51.0.119/32", "34.240.137.52/32", "51.20.27.3/32", "52.213.46.74/32"]
  validation {
    condition     = length(var.smile_id_production_callback_ipv4_cidrs) > 0 && alltrue([for cidr in var.smile_id_production_callback_ipv4_cidrs : can(cidrnetmask(cidr)) && endswith(cidr, "/32")])
    error_message = "Production Smile ID callback addresses must be non-empty IPv4 /32 entries from the provider's current documentation."
  }
}
variable "admin_ip_allow_list" {
  description = "CIDR ranges permitted to reach admin routes through the gateway. Required outside dev."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.admin_ip_allow_list : can(cidrnetmask(cidr)) && !contains(["0.0.0.0/0", "::/0"], cidr)])
    error_message = "Admin access requires valid restricted IPv4 CIDRs."
  }
}
variable "blocked_client_ip_cidrs" {
  description = "Client IPv4/IPv6 addresses or CIDR ranges blocked at the API gateway. Use /32 or /128 for one address."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.blocked_client_ip_cidrs : can(cidrhost(cidr, 0)) && !endswith(cidr, "/0")])
    error_message = "blocked_client_ip_cidrs must contain valid, non-global IPv4 or IPv6 CIDRs."
  }
}
variable "image_tag" {
  description = "Initial image tag; CI registers new task definitions afterwards (Terraform ignores them)."
  type        = string
  default     = "bootstrap"
}
variable "enable_media_malware_scanning" {
  description = "Run the pinned ClamAV scanner sidecar in media tasks. Requires additional task memory for signature databases."
  type        = bool
  default     = false
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
  description = "Reviewed IPv4 ranges go-money may reach on 443. Security groups cannot express hostnames; use an egress proxy/domain firewall when provider ranges are dynamic. Empty denies direct internet egress."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.payments_internet_egress_cidrs : can(cidrnetmask(cidr)) && cidr != "0.0.0.0/0"])
    error_message = "Payment internet egress must use explicit, valid IPv4 CIDRs; 0.0.0.0/0 is not allowed."
  }
}

variable "service_internet_egress_cidrs" {
  description = "Reviewed IPv4 ranges shared ECS services may reach on 443. Prefer VPC endpoints and an egress proxy/domain firewall for dynamic provider hostnames. Empty denies direct internet egress."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.service_internet_egress_cidrs : can(cidrnetmask(cidr)) && cidr != "0.0.0.0/0"])
    error_message = "Service internet egress must use explicit, valid IPv4 CIDRs; 0.0.0.0/0 is not allowed."
  }
}
