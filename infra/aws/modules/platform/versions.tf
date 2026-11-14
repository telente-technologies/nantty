terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.70"
      configuration_aliases = [aws.us_east_1, aws.dr]
    }
    random     = { source = "hashicorp/random", version = "~> 3.6" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.28.0" }
  }
}
