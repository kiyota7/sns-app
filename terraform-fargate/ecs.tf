# ECSクラスタ・タスク定義・サービス。
#
# コスト最小化のため:
#   - 最小タスクサイズ(0.25 vCPU / 0.5 GB)
#   - desired_count = 1(冗長構成にしない)
#   - Fargate Spot をデフォルトで採用(オンデマンドの約30%程度のコストで済む代わり、
#     中断されうる。採点・デモ中に中断が問題になる場合は、下の
#     capacity_provider_strategy のFARGATE_SPOTをFARGATEに変更するだけでよい)

resource "aws_ecs_cluster" "this" {
  name = "sns-app-fargate-cluster"
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/sns-app-fargate-backend"
  retention_in_days = 7 # ログ保存コストを抑えるため短めに設定

  tags = {
    Name = "sns-app-fargate-backend-logs"
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "sns-app-fargate-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256" # 0.25 vCPU(Fargateの最小サイズ)
  memory                   = "512" # 0.5 GB

  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.container_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        # SQLite用のapplication.properties(既存EC2構成)ではなく、追加したPostgreSQL
        # 用のプロファイル(application-postgres.properties)を有効化する。
        { name = "SPRING_PROFILES_ACTIVE", value = "postgres" },
        { name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}" },
        { name = "SPRING_DATASOURCE_USERNAME", value = var.db_username },
        { name = "APP_STORAGE_TYPE", value = "s3" },
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.uploads.bucket },
        { name = "AWS_REGION", value = var.aws_region },
      ]

      # 機密情報(JWTシークレット・DBパスワード)は平文環境変数ではなく、
      # SSM Parameter Store(SecureString)から実行時に注入する。
      secrets = [
        { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
        { name = "SPRING_DATASOURCE_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])

  tags = {
    Name = "sns-app-fargate-backend"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "sns-app-fargate-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }

  network_configuration {
    subnets = data.aws_subnets.default.ids
    # NAT Gatewayを使わずECRからのイメージpull・S3アクセスを可能にするため、
    # パブリックサブネット+パブリックIP付与にしている。直接インターネットに
    # 晒されないのは、security.tfでECSタスクのSGがALBのSGからの8080番以外を
    # 許可していないため。
    security_groups  = [aws_security_group.ecs_task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8080
  }

  # ALBのリスナーが先に存在しないと、ターゲットグループへの登録に失敗しうるため明示する。
  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "sns-app-fargate-backend"
  }
}
