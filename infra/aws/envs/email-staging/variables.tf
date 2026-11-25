variable "region" {
  type    = string
  default = "eu-north-1"

  validation {
    condition     = var.region == "eu-north-1"
    error_message = "The Nantty AWS project is assigned to eu-north-1."
  }
}

variable "mail_domain" {
  type    = string
  default = "staging.nantty.com"

  validation {
    condition     = var.mail_domain == "staging.nantty.com"
    error_message = "The isolated staging SES identity must use staging.nantty.com."
  }
}

variable "cloudflare_zone_id" {
  type = string

  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_zone_id))
    error_message = "cloudflare_zone_id must be the 32-character Nantty Cloudflare zone ID."
  }
}

variable "dmarc_report_address" {
  type    = string
  default = "dmarc@nantty.com"

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.dmarc_report_address))
    error_message = "dmarc_report_address must be a valid mailbox or DMARC reporting destination."
  }
}
