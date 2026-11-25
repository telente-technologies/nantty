terraform {
  backend "s3" {
    bucket         = "nantty-tfstate-324009946456-eu-north-1-an"
    key            = "platform/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "nantty-terraform-locks"
    encrypt        = true
  }
}
