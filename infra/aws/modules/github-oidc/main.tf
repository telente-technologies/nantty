terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  provider_arn = var.create_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  account_id   = data.aws_caller_identity.current.account_id
}

data "aws_iam_policy_document" "push_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "ecr_push" {
  name               = "nantty-${var.environment}-github-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.push_trust.json
}

data "aws_iam_policy_document" "ecr_push" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload", "ecr:DescribeImages", "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart",
    ]
    resources = values(var.ecr_repository_arns)
  }
}

resource "aws_iam_role_policy" "ecr_push" {
  role   = aws_iam_role.ecr_push.id
  policy = data.aws_iam_policy_document.ecr_push.json
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.repository}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "nantty-${var.environment}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "ReadMigrationRecoveryEvidence"
    actions   = ["backup:DescribeRestoreJob", "backup:DescribeRecoveryPoint", "rds:DescribeDBClusters", "rds:DescribeDBClusterSnapshots"]
    resources = ["*"]
  }
  statement {
    sid       = "PreMigrationSnapshot"
    actions   = ["rds:CreateDBClusterSnapshot"]
    resources = ["arn:aws:rds:*:${local.account_id}:cluster:nantty-${var.environment}*", "arn:aws:rds:*:${local.account_id}:cluster-snapshot:nantty-${var.environment}-pre-migration-*"]
  }
  statement {
    sid       = "DescribeAndRegister"
    actions   = ["ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition", "ecs:ListTasks", "ecs:DescribeTasks", "ecs:DescribeClusters"]
    resources = ["*"]
  }
  statement {
    sid       = "UpdateServicesInCluster"
    actions   = ["ecs:UpdateService", "ecs:RunTask"]
    resources = ["arn:aws:ecs:*:${local.account_id}:service/nantty-${var.environment}/*", "arn:aws:ecs:*:${local.account_id}:task-definition/nantty-${var.environment}-*:*"]
  }
  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/nantty-${var.environment}-*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
  statement {
    sid       = "BlueGreen"
    actions   = ["codedeploy:CreateDeployment", "codedeploy:GetDeployment", "codedeploy:GetDeploymentConfig", "codedeploy:GetApplicationRevision", "codedeploy:RegisterApplicationRevision", "codedeploy:StopDeployment"]
    resources = ["arn:aws:codedeploy:*:${local.account_id}:*nantty-${var.environment}-*"]
  }
  statement {
    sid       = "PullImagesForPromotion"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "PromoteImages"
    actions   = ["ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"]
    resources = values(var.ecr_repository_arns)
  }
  dynamic "statement" {
    for_each = var.promotion_source_account_id == "" ? [] : [1]
    content {
      sid       = "PullPromotedImagesFromSourceAccount"
      actions   = ["ecr:GetAuthorizationToken"]
      resources = ["*"]
    }
  }
  dynamic "statement" {
    for_each = var.promotion_source_account_id == "" ? [] : [1]
    content {
      sid       = "PullFromSourceRegistry"
      actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
      resources = ["arn:aws:ecr:*:${var.promotion_source_account_id}:repository/nantty/*"]
    }
  }
  statement {
    sid       = "ReadLogsForSmokeFailures"
    actions   = ["logs:GetLogEvents", "logs:FilterLogEvents"]
    resources = ["arn:aws:logs:*:${local.account_id}:log-group:/nantty/${var.environment}/*:*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
