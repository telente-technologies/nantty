variable "environment" { type = string }
variable "region" { type = string }
variable "mail_domain" { type = string }
variable "cloudflare_zone_id" { type = string }
variable "sns_kms_key_id" { type = string }
variable "sqs_kms_key_id" {
  type    = string
  default = null
}
variable "sqs_managed_sse_enabled" {
  type    = bool
  default = false
}
variable "dmarc_report_address" { type = string }
variable "create_dmarc_record" {
  type        = bool
  default     = true
  description = "Create a DMARC record for the mail domain. Disable when an existing parent policy already governs the subdomain."
}
variable "dmarc_policy" {
  type        = string
  default     = "none"
  description = "Start at none while reading rua reports, then move to quarantine and reject (docs/emailAddresses.md)."
  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_policy)
    error_message = "dmarc_policy must be none, quarantine or reject."
  }
}
