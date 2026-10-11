terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  self_hosted = var.mode == "self_hosted"
  name        = "zudomart-${var.environment}-livekit"
}

resource "random_password" "api_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "credentials" {
  name       = "zudomart/${var.environment}/livekit"
  kms_key_id = var.secrets_kms_key_arn
}

resource "aws_secretsmanager_secret_version" "credentials" {
  secret_id = aws_secretsmanager_secret.credentials.id
  secret_string = jsonencode(local.self_hosted ? {
    LIVEKIT_URL        = "wss://${var.host}"
    LIVEKIT_API_KEY    = "zudomart"
    LIVEKIT_API_SECRET = random_password.api_secret.result
    LIVEKIT_CONFIG     = <<-YAML
      port: 7880
      keys:
        zudomart: ${random_password.api_secret.result}
      rtc:
        tcp_port: 7881
        udp_port: 7882
        use_external_ip: true
      redis:
        address: ${var.valkey_endpoint}:6379
        password: ${var.valkey_auth_token}
        use_tls: true
      turn:
        enabled: false
      room:
        auto_create: false
      webhook:
        api_key: zudomart
        urls:
          - ${var.webhook_url}
      logging:
        json: true
    YAML
    } : {
    LIVEKIT_URL        = "wss://replace-with-your-project.livekit.cloud"
    LIVEKIT_API_KEY    = "replace-me"
    LIVEKIT_API_SECRET = "replace-me"
  })
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_security_group" "node" {
  count       = local.self_hosted ? 1 : 0
  name_prefix = "${local.name}-"
  description = "LiveKit media node"
  vpc_id      = var.vpc_id
  ingress {
    description     = "Signaling from the ALB"
    from_port       = 7880
    to_port         = 7880
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }
  ingress {
    description = "ICE over TCP"
    from_port   = 7881
    to_port     = 7881
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "ICE over UDP (single mux port)"
    from_port   = 7882
    to_port     = 7882
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  lifecycle { create_before_destroy = true }
}

data "aws_ssm_parameter" "ecs_ami" {
  count = local.self_hosted ? 1 : 0
  name  = "/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id"
}

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  count              = local.self_hosted ? 1 : 0
  name               = "${local.name}-node"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "node" {
  for_each = local.self_hosted ? toset([
    "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  ]) : toset([])
  role       = aws_iam_role.node[0].name
  policy_arn = each.value
}

resource "aws_iam_instance_profile" "node" {
  count = local.self_hosted ? 1 : 0
  name  = "${local.name}-node"
  role  = aws_iam_role.node[0].name
}

resource "aws_launch_template" "node" {
  count                  = local.self_hosted ? 1 : 0
  name_prefix            = "${local.name}-"
  image_id               = data.aws_ssm_parameter.ecs_ami[0].value
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.node[0].id]
  iam_instance_profile { name = aws_iam_instance_profile.node[0].name }
  user_data = base64encode("#!/bin/bash\necho ECS_CLUSTER=${var.cluster_name} >> /etc/ecs/ecs.config\necho ECS_CONTAINER_INSTANCE_TAGS={\\\"role\\\":\\\"livekit\\\"} >> /etc/ecs/ecs.config\n")
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 30
      encrypted   = true
    }
  }
}

resource "aws_autoscaling_group" "node" {
  count                 = local.self_hosted ? 1 : 0
  name                  = local.name
  min_size              = var.node_count
  max_size              = var.node_count * 2
  desired_capacity      = var.node_count
  vpc_zone_identifier   = var.public_subnet_ids
  protect_from_scale_in = true
  launch_template {
    id      = aws_launch_template.node[0].id
    version = "$Latest"
  }
  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }
}

resource "aws_ecs_capacity_provider" "node" {
  count = local.self_hosted ? 1 : 0
  name  = local.name
  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.node[0].arn
    managed_termination_protection = "ENABLED"
    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }
  }
}
