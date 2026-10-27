terraform {
  backend "s3" {
    bucket         = "nantty-terraform-state-staging"
    key            = "platform/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "nantty-terraform-locks"
    encrypt        = true
  }
}
