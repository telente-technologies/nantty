locals {
  tls_issuer_zip = "${path.module}/../../tls-proxy/dist/issuer.zip"
  tls_identity   = { for name in local.service_names : name => "${name}.${module.cluster.namespace_name}" }
  tls_app_environment = {
    for name in local.service_names : name => merge(local.common_environment,
      local.runtime_environment[local.runtime_of[name]], lookup(local.service_specific_environment, name, {}),
    lookup(local.internal_wiring_environment, name, {}), lookup(local.database_schema_environment, name, {}))
  }
  tls_http_clients = {
    for target in local.internal_names : target => [for name in local.service_names : name
    if strcontains(jsonencode(local.tls_app_environment[name]), local.internal_url[target])]
  }
  tls_grpc_clients = { go-identity = ["go-money", "go-live"], go-money = ["go-commerce", "go-live", "go-ads"] }
  tls_clients = { for name in local.service_names : name => distinct(concat(
  lookup(local.tls_http_clients, name, []), lookup(local.tls_grpc_clients, name, []))) }
}

resource "aws_acmpca_certificate_authority" "mesh" {
  type                            = "ROOT"
  usage_mode                      = "SHORT_LIVED_CERTIFICATE"
  permanent_deletion_time_in_days = 7
  certificate_authority_configuration {
    key_algorithm     = "RSA_2048"
    signing_algorithm = "SHA256WITHRSA"
    subject { common_name = "Nantty ${var.environment} task mesh" }
  }
  tags = { Name = "${local.tags_prefix}-mesh" }
}

resource "aws_acmpca_certificate" "mesh_root" {
  certificate_authority_arn   = aws_acmpca_certificate_authority.mesh.arn
  certificate_signing_request = aws_acmpca_certificate_authority.mesh.certificate_signing_request
  signing_algorithm           = "SHA256WITHRSA"
  template_arn                = "arn:aws:acm-pca:::template/RootCACertificate/V1"
  validity {
    type  = "YEARS"
    value = 10
  }
}

resource "aws_acmpca_certificate_authority_certificate" "mesh" {
  certificate_authority_arn = aws_acmpca_certificate_authority.mesh.arn
  certificate               = aws_acmpca_certificate.mesh_root.certificate
  certificate_chain         = aws_acmpca_certificate.mesh_root.certificate_chain
}

resource "aws_secretsmanager_secret" "tls" {
  for_each   = local.services
  name       = "nantty/${var.environment}/tls/${each.key}"
  kms_key_id = module.kms.key_arns["secrets"]
}

resource "aws_iam_role" "tls_issuer" {
  for_each = local.services
  name     = "${local.tags_prefix}-${each.key}-tls-issuer"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" }
  }] })
}

resource "aws_cloudwatch_log_group" "tls_issuer" {
  for_each          = local.services
  name              = "/aws/lambda/${local.tags_prefix}-${each.key}-tls-issuer"
  retention_in_days = var.log_retention_days
  kms_key_id        = module.kms.key_arns["logs"]
}

resource "aws_iam_role_policy" "tls_issuer" {
  for_each = local.services
  role     = aws_iam_role.tls_issuer[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["acm-pca:IssueCertificate"], Resource = aws_acmpca_certificate_authority.mesh.arn,
    Condition = { StringEquals = { "acm-pca:TemplateArn" = "arn:aws:acm-pca:::template/EndEntityCertificate_APICSRPassthrough/V1" } } },
    { Effect = "Allow", Action = ["acm-pca:GetCertificate", "acm-pca:GetCertificateAuthorityCertificate"], Resource = aws_acmpca_certificate_authority.mesh.arn },
    { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue"], Resource = aws_secretsmanager_secret.tls[each.key].arn },
    { Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = module.kms.key_arns["secrets"],
    Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${var.region}.amazonaws.com", "kms:EncryptionContext:SecretARN" = aws_secretsmanager_secret.tls[each.key].arn } } },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.tls_issuer[each.key].arn}:*" },
    { Effect = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*",
    Condition = { StringEquals = { "cloudwatch:namespace" = "Nantty/${var.environment}/TLS" } } },
  ] })
}

resource "aws_lambda_function" "tls_issuer" {
  for_each                       = local.services
  function_name                  = "${local.tags_prefix}-${each.key}-tls-issuer"
  role                           = aws_iam_role.tls_issuer[each.key].arn
  filename                       = local.tls_issuer_zip
  source_code_hash               = try(filebase64sha256(local.tls_issuer_zip), null)
  handler                        = "issuer.handler"
  runtime                        = "python3.12"
  architectures                  = ["x86_64"]
  timeout                        = 90
  memory_size                    = 256
  reserved_concurrent_executions = 1
  environment {
    variables = {
      IDENTITY         = local.tls_identity[each.key]
      CA_ARN           = aws_acmpca_certificate_authority.mesh.arn
      SECRET_ARN       = aws_secretsmanager_secret.tls[each.key].arn
      SERVICE_NAME     = each.key
      METRIC_NAMESPACE = "Nantty/${var.environment}/TLS"
    }
  }
  depends_on = [aws_iam_role_policy.tls_issuer, aws_acmpca_certificate_authority_certificate.mesh]
  lifecycle {
    precondition {
      condition     = fileexists(local.tls_issuer_zip)
      error_message = "Run bash infra/aws/tls-proxy/build-issuer.sh before planning/applying infrastructure."
    }
    precondition {
      condition     = var.livekit_mode == "cloud"
      error_message = "This secure bootstrap uses LiveKit Cloud. The legacy self_hosted host-network signaling task is not TLS protected and cannot be enabled."
    }
  }
}

# Apply-time only, never a data source: no AWS invocation during a plan.
resource "aws_lambda_invocation" "tls_bootstrap" {
  for_each      = local.services
  function_name = aws_lambda_function.tls_issuer[each.key].function_name
  input         = jsonencode({ bootstrap = true })
  triggers = {
    code = aws_lambda_function.tls_issuer[each.key].source_code_hash
    ca   = aws_acmpca_certificate_authority.mesh.arn
  }
  lifecycle {
    postcondition {
      condition     = try(jsondecode(self.result).identity == local.tls_identity[each.key], false)
      error_message = "TLS bootstrap did not confirm the expected service identity."
    }
  }
}

resource "aws_cloudwatch_event_rule" "tls_rotation" {
  for_each            = local.services
  name                = "${local.tags_prefix}-${each.key}-tls-rotation"
  schedule_expression = "rate(1 day)"
}

resource "aws_lambda_permission" "tls_rotation" {
  for_each      = local.services
  statement_id  = "EventBridgeRotation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tls_issuer[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.tls_rotation[each.key].arn
}

resource "aws_cloudwatch_event_target" "tls_rotation" {
  for_each = local.services
  rule     = aws_cloudwatch_event_rule.tls_rotation[each.key].name
  arn      = aws_lambda_function.tls_issuer[each.key].arn
  retry_policy {
    maximum_event_age_in_seconds = 21600
    maximum_retry_attempts       = 10
  }
  depends_on = [aws_lambda_permission.tls_rotation]
}

resource "aws_cloudwatch_metric_alarm" "tls_rotation" {
  for_each            = local.services
  alarm_name          = "${local.tags_prefix}-${each.key}-tls-rotation"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.tls_issuer[each.key].function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.observability.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "tls_rotation_missing" {
  for_each            = local.services
  alarm_name          = "${local.tags_prefix}-${each.key}-tls-rotation-missing"
  namespace           = "Nantty/${var.environment}/TLS"
  metric_name         = "RotationCheckSuccess"
  dimensions          = { Service = each.key }
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [module.observability.alarm_topic_arn]
}
