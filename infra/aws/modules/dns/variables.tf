variable "zone_name" { type = string }
variable "create_zone" {
  type    = bool
  default = false
}
variable "cloudflare_zone_id" { type = string }
variable "api_domain" { type = string }
variable "media_domain" { type = string }
variable "extra_api_domains" {
  type    = list(string)
  default = []
}
