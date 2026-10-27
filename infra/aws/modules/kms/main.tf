terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  purposes = toset(["data", "secrets", "logs", "kyc", "ecr", "backup", "sns"])
}

data "aws_iam_policy_document" "key" {
  for_each = local.purposes

  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  dynamic "statement" {
    for_each = each.key == "logs" ? [1] : []
    content {
      sid       = "CloudWatchLogs"
      actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
      resources = ["*"]
      principals {
        type        = "Service"
        identifiers = ["logs.${data.aws_region.current.name}.amazonaws.com"]
      }
      condition {
        test     = "ArnLike"
        variable = "kms:EncryptionContext:aws:logs:arn"
        values   = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"]
      }
    }
  }

  dynamic "statement" {
    for_each = length(lookup(var.key_user_role_arns, each.key, [])) > 0 ? [1] : []
    content {
      sid       = "ServiceTasksThroughS3"
      actions   = ["kms:Decrypt", "kms:GenerateDataKey", "kms:Encrypt"]
      resources = ["*"]
      principals {
        type        = "AWS"
        identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
      }
      condition {
        test     = "ArnEquals"
        variable = "aws:PrincipalArn"
        values   = var.key_user_role_arns[each.key]
      }
      condition {
        test     = "StringEquals"
        variable = "kms:ViaService"
        values   = ["s3.${data.aws_region.current.name}.amazonaws.com"]
      }
    }
  }

  dynamic "statement" {
    for_each = each.key == "sns" ? [1] : []
    content {
      sid       = "ServicesPublishToEncryptedTopics"
      actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
      resources = ["*"]
      principals {
        type        = "Service"
        identifiers = ["cloudwatch.amazonaws.com", "ses.amazonaws.com", "events.amazonaws.com", "codedeploy.amazonaws.com"]
      }
    }
  }
}

resource "aws_kms_key" "this" {
  for_each                = local.purposes
  description             = "nantty ${var.environment} ${each.key}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  multi_region            = contains(var.multi_region_purposes, each.key)
  policy                  = data.aws_iam_policy_document.key[each.key].json
}

resource "aws_kms_alias" "this" {
  for_each      = local.purposes
  name          = "alias/nantty-${var.environment}-${each.key}"
  target_key_id = aws_kms_key.this[each.key].key_id
}
