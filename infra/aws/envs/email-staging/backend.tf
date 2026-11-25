terraform {
  backend "s3" {
    bucket         = "nantty-terraform-state-staging"
    key            = "email/ses/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "nantty-terraform-locks"
    encrypt        = true
  }
}
