variable "zone_name" { type = string }
variable "create_zone" {
  type    = bool
  default = false
}
variable "api_domain" { type = string }
variable "media_domain" { type = string }
variable "extra_api_domains" {
  type    = list(string)
  default = []
}
variable "alb_dns_name" { type = string }
variable "alb_zone_id" { type = string }
variable "media_distribution_domain_name" { type = string }
variable "media_distribution_zone_id" { type = string }
