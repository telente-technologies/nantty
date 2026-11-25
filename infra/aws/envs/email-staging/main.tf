data "aws_caller_identity" "current" {}

locals {
  ses_feedback_topic_name = "nantty-staging-ses-feedback"
  ses_feedback_topic_arn  = "arn:aws:sns:${var.region}:${data.aws_caller_identity.current.account_id}:${local.ses_feedback_topic_name}"
}

data "aws_iam_policy_document" "ses_feedback_key" {
  statement {
    sid       = "AccountKeyAdministration"
    actions   = ["kms:*"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid       = "SesEventPublisherUse"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/nantty-staging"]
    }
  }

  statement {
    sid       = "SnsFeedbackTopicUse"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "ArnEquals"
      variable = "kms:EncryptionContext:aws:sns:topicArn"
      values   = [local.ses_feedback_topic_arn]
    }
  }
}

resource "aws_kms_key" "ses_feedback" {
  description             = "Nantty staging SES feedback topic"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.ses_feedback_key.json
}

resource "aws_kms_alias" "ses_feedback" {
  name          = "alias/nantty-staging-ses-feedback"
  target_key_id = aws_kms_key.ses_feedback.key_id
}

module "ses" {
  source = "../../modules/ses"

  environment             = "staging"
  region                  = var.region
  mail_domain             = var.mail_domain
  cloudflare_zone_id      = var.cloudflare_zone_id
  dmarc_report_address    = var.dmarc_report_address
  dmarc_policy            = "none"
  sns_kms_key_id          = aws_kms_key.ses_feedback.key_id
  sqs_kms_key_id          = null
  sqs_managed_sse_enabled = true
}

output "ses_identity_arn" {
  value = module.ses.identity_arn
}

output "ses_configuration_set_name" {
  value = module.ses.configuration_set_name
}

output "ses_feedback_queue_url" {
  value = module.ses.feedback_queue_url
}
