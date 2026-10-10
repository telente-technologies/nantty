variable "environment" { type = string }
variable "rate_limit_per_five_minutes" {
  description = "Requests per client IP per 5 minutes before CloudFront blocks it. Kept high because mobile carriers put many users behind one CGNAT address and HLS playback fetches a segment every few seconds."
  type        = number
  default     = 10000
}
variable "anonymous_ip_action" {
  description = "count or block for AWSManagedRulesAnonymousIpList. Starts as count: VPN and hosting-provider traffic includes legitimate viewers."
  type        = string
  default     = "count"
  validation {
    condition     = contains(["count", "block"], var.anonymous_ip_action)
    error_message = "anonymous_ip_action must be count or block."
  }
}
variable "log_retention_days" {
  type    = number
  default = 365
}
variable "redacted_headers" {
  type    = list(string)
  default = ["authorization", "cookie", "x-step-up-token"]
}
