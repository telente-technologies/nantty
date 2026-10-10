variable "environment" { type = string }
variable "media_domain" { type = string }
variable "media_certificate_arn" {
  description = "ACM certificate in us-east-1 covering media_domain."
  type        = string
}
variable "kyc_kms_key_arn" { type = string }
variable "kyc_dr_kms_key_arn" {
  type    = string
  default = null
}
variable "enable_dr" {
  type    = bool
  default = false
}
variable "upload_cors_origins" { type = list(string) }
variable "log_retention_days" {
  type    = number
  default = 365
}
variable "kyc_object_lock_days" {
  type    = number
  default = 30
}
variable "cloudfront_price_class" {
  type    = string
  default = "PriceClass_100"
}
variable "media_signing_public_key_pem" {
  description = "PEM public key for CloudFront signed URLs on /paid/*, or null to disable paid media."
  type        = string
  default     = null
}
variable "dr_region" {
  type    = string
  default = null
}
variable "media_key_user_role_arns" {
  description = "Task role ARNs allowed to use the media CMK through S3 (matched on aws:PrincipalArn, so the roles may not exist yet)."
  type        = list(string)
  default     = []
}
variable "web_acl_arn" {
  description = "CLOUDFRONT-scope WAF web ACL (us-east-1) attached to the media distribution."
  type        = string
}
