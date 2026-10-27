terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.repositories)
  name                 = "nantty/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [
      { rulePriority = 1, description = "Drop untagged images after 7 days", selection = { tagStatus = "untagged", countType = "sinceImagePushed", countUnit = "days", countNumber = 7 }, action = { type = "expire" } },
      { rulePriority = 2, description = "Keep the last ${var.keep_tagged_images} images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = var.keep_tagged_images }, action = { type = "expire" } },
    ]
  })
}

resource "aws_ecr_registry_scanning_configuration" "this" {
  scan_type = "ENHANCED"
  rule {
    scan_frequency = "CONTINUOUS_SCAN"
    repository_filter {
      filter      = "nantty/*"
      filter_type = "WILDCARD"
    }
  }
}

resource "aws_ecr_replication_configuration" "dr" {
  count = var.replicate_to_region == null ? 0 : 1
  replication_configuration {
    rule {
      destination {
        region      = var.replicate_to_region
        registry_id = data.aws_caller_identity.current.account_id
      }
      repository_filter {
        filter      = "nantty/"
        filter_type = "PREFIX_MATCH"
      }
    }
  }
}

data "aws_iam_policy_document" "cross_account_pull" {
  count = length(var.pull_account_ids) > 0 ? 1 : 0
  statement {
    sid     = "PromotionPull"
    actions = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    principals {
      type        = "AWS"
      identifiers = [for id in var.pull_account_ids : "arn:aws:iam::${id}:root"]
    }
  }
}

resource "aws_ecr_repository_policy" "cross_account_pull" {
  for_each   = length(var.pull_account_ids) > 0 ? aws_ecr_repository.this : {}
  repository = each.value.name
  policy     = data.aws_iam_policy_document.cross_account_pull[0].json
}
