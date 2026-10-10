locals {
  media_key_principals = {
    primary = { region = data.aws_region.current.name, key_users = var.media_key_user_role_arns }
    dr      = { region = var.dr_region, key_users = [] }
  }
}

data "aws_iam_policy_document" "media_key" {
  for_each = var.enable_dr ? local.media_key_principals : { primary = local.media_key_principals.primary }

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
    for_each = length(each.value.key_users) > 0 ? [1] : []
    content {
      sid       = "ServiceTasksThroughS3"
      actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
      resources = ["*"]
      principals {
        type        = "AWS"
        identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
      }
      condition {
        test     = "ArnEquals"
        variable = "aws:PrincipalArn"
        values   = each.value.key_users
      }
      condition {
        test     = "StringEquals"
        variable = "kms:ViaService"
        values   = ["s3.${each.value.region}.amazonaws.com"]
      }
    }
  }

  statement {
    sid       = "CloudFrontOacReadsMedia"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media.arn]
    }
  }
}

resource "aws_kms_key" "media" {
  description             = "zudomart ${var.environment} media"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.media_key["primary"].json
}

resource "aws_kms_alias" "media" {
  name          = "alias/zudomart-${var.environment}-media"
  target_key_id = aws_kms_key.media.key_id
}

resource "aws_kms_key" "media_dr" {
  provider                = aws.dr
  count                   = var.enable_dr ? 1 : 0
  description             = "zudomart ${var.environment} media (DR replica bucket)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.media_key["dr"].json
}

resource "aws_kms_alias" "media_dr" {
  provider      = aws.dr
  count         = var.enable_dr ? 1 : 0
  name          = "alias/zudomart-${var.environment}-media"
  target_key_id = aws_kms_key.media_dr[0].key_id
}
