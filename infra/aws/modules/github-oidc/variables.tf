variable "environment" { type = string }
variable "repository" {
  description = "GitHub owner/name allowed to assume the roles."
  type        = string
}
variable "github_environment" {
  description = "GitHub environment name carried in the OIDC subject claim."
  type        = string
}
variable "create_provider" {
  description = "Create the account-wide GitHub OIDC provider (once per account)."
  type        = bool
  default     = true
}
variable "ecr_repository_arns" { type = map(string) }
variable "promotion_source_account_id" {
  description = "Account whose ECR images are promoted here (staging account id in prod), empty otherwise."
  type        = string
  default     = ""
}
