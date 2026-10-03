terraform {
  backend "s3" {
    bucket         = "zudomart-terraform-state-staging"
    key            = "platform/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "zudomart-terraform-locks"
    encrypt        = true
  }
}
