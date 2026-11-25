terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 5.70" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.28.0" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name = "nantty-${var.environment}"
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.mail_domain
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  dkim_signing_attributes { next_signing_key_length = "RSA_2048_BIT" }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "bounce.${var.mail_domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "cloudflare_dns_record" "dkim" {
  count   = 3
  zone_id = var.cloudflare_zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.mail_domain}"
  type    = "CNAME"
  content = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  proxied = false
  ttl     = 600
  comment = "Amazon SES Easy DKIM for ${var.mail_domain}"
}

resource "cloudflare_dns_record" "mail_from_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = "bounce.${var.mail_domain}"
  type     = "MX"
  content  = "feedback-smtp.${var.region}.amazonses.com"
  priority = 10
  proxied  = false
  ttl      = 600
  comment  = "Amazon SES custom MAIL FROM for ${var.mail_domain}"
}

resource "cloudflare_dns_record" "mail_from_spf" {
  zone_id = var.cloudflare_zone_id
  name    = "bounce.${var.mail_domain}"
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  proxied = false
  ttl     = 600
  comment = "Amazon SES custom MAIL FROM SPF for ${var.mail_domain}"
}

resource "cloudflare_dns_record" "dmarc" {
  count   = var.create_dmarc_record ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.${var.mail_domain}"
  type    = "TXT"
  content = "v=DMARC1; p=${var.dmarc_policy}; rua=mailto:${var.dmarc_report_address}; adkim=r; aspf=r; fo=1"
  proxied = false
  ttl     = 600
  comment = "DMARC policy for ${var.mail_domain}"
}

resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = local.name
  delivery_options { tls_policy = "REQUIRE" }
  reputation_options { reputation_metrics_enabled = true }
  sending_options { sending_enabled = true }
  suppression_options { suppressed_reasons = ["BOUNCE", "COMPLAINT"] }
}

resource "aws_sns_topic" "feedback" {
  name              = "${local.name}-ses-feedback"
  kms_master_key_id = var.sns_kms_key_id
}

resource "aws_sqs_queue" "feedback_dead_letter" {
  name                      = "${local.name}-notifications-ses-feedback-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.sqs_kms_key_id
  sqs_managed_sse_enabled   = var.sqs_managed_sse_enabled
}

resource "aws_sqs_queue" "feedback" {
  name                       = "${local.name}-notifications-ses-feedback"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
  kms_master_key_id          = var.sqs_kms_key_id
  sqs_managed_sse_enabled    = var.sqs_managed_sse_enabled
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.feedback_dead_letter.arn
    maxReceiveCount     = 5
  })
}

data "aws_iam_policy_document" "feedback_queue" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.feedback.arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.feedback.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "feedback" {
  queue_url = aws_sqs_queue.feedback.id
  policy    = data.aws_iam_policy_document.feedback_queue.json
}

resource "aws_sns_topic_subscription" "feedback" {
  topic_arn            = aws_sns_topic.feedback.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.feedback.arn
  raw_message_delivery = true
}

data "aws_iam_policy_document" "feedback_topic" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.feedback.arn]
    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "feedback" {
  arn    = aws_sns_topic.feedback.arn
  policy = data.aws_iam_policy_document.feedback_topic.json
}

resource "aws_sesv2_configuration_set_event_destination" "feedback" {
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  event_destination_name = "feedback"

  depends_on = [aws_sns_topic_policy.feedback]

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT", "REJECT", "DELIVERY_DELAY"]
    sns_destination { topic_arn = aws_sns_topic.feedback.arn }
  }
}
