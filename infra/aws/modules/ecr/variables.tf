variable "repositories" { type = list(string) }
variable "kms_key_arn" { type = string }
variable "keep_tagged_images" {
  type    = number
  default = 50
}
variable "replicate_to_region" {
  description = "DR region for cross-region replication, or null to disable."
  type        = string
  default     = null
}
variable "pull_account_ids" {
  description = "Accounts allowed to pull images for promotion (the production account on staging repositories)."
  type        = list(string)
  default     = []
}
