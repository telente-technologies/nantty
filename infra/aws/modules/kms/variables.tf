variable "environment" { type = string }
variable "multi_region_purposes" {
  description = "Key purposes created as multi-region keys so a replica can decrypt in the DR region."
  type        = list(string)
  default     = []
}
variable "key_user_role_arns" {
  description = "Per purpose, task roles allowed to use that key through S3."
  type        = map(list(string))
  default     = {}
}
