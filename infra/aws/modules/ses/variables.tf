variable "environment" { type = string }
variable "region" { type = string }
variable "mail_domain" { type = string }
variable "zone_id" { type = string }
variable "sns_kms_key_id" { type = string }
variable "dmarc_report_address" { type = string }
variable "dmarc_policy" {
  type        = string
  default     = "none"
  description = "Start at none while reading rua reports, then move to quarantine and reject (docs/emailAddresses.md)."
  validation {
    condition     = contains(["none", "quarantine", "reject"], var.dmarc_policy)
    error_message = "dmarc_policy must be none, quarantine or reject."
  }
}
