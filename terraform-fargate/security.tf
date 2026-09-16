# 3段構成のセキュリティグループで、ALBだけをインターネットに公開し、
# ECSタスク・RDSは「一つ内側のSGからの通信のみ」を許可することで、
# パブリックサブネットに置きつつ実質的に非公開の状態を保つ。
# (NAT Gatewayを使わずインターネットアクセスを確保するため、ECSタスクは
# パブリックサブネット+パブリックIP付与にしている。詳細はecs.tf参照)
#
# ALB(インターネット) → ECSタスク(ALBのSGからのみ) → RDS(ECSタスクのSGからのみ)

resource "aws_security_group" "alb" {
  name        = "sns-app-fargate-alb-sg"
  description = "Allow HTTP inbound from the internet, all outbound"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_http_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sns-app-fargate-alb-sg"
  }
}

resource "aws_security_group" "ecs_task" {
  name        = "sns-app-fargate-task-sg"
  description = "Allow inbound from ALB only (port 8080), all outbound"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "App port from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # ECRからのイメージpull・S3アクセスにはNAT Gateway/VPCエンドポイントを使わず、
  # パブリックIP経由のアウトバウンド通信で賄う(コスト優先のため)。
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sns-app-fargate-task-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "sns-app-fargate-rds-sg"
  description = "Allow inbound from ECS task only (port 5432)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from ECS task"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_task.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sns-app-fargate-rds-sg"
  }
}
