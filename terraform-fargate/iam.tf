# ECSには役割の異なる2つのIAMロールが必要になる。
#   - タスク実行ロール: ECS基盤自身が使う(ECRからのイメージpull・CloudWatch Logsへの
#     書き込み・SSM Parameter Storeからのシークレット取得)。アプリコードからは見えない。
#   - タスクロール: コンテナ内で動くアプリケーション自身が使う(S3への画像アップロード等)。
#     既存terraform/iam.tfのEC2 SSMロールに相当するのがこちら。

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- タスク実行ロール ---

resource "aws_iam_role" "ecs_task_execution" {
  name               = "sns-app-fargate-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# AmazonECSTaskExecutionRolePolicyにはSSM Parameter Store読み取り権限が
# 含まれていないため、タスク定義のsecretsブロック(JWT_SECRET・DBパスワード)が
# 動作するように個別に付与する。
data "aws_iam_policy_document" "ecs_task_execution_ssm" {
  statement {
    effect  = "Allow"
    actions = ["ssm:GetParameters"]
    resources = [
      aws_ssm_parameter.jwt_secret.arn,
      aws_ssm_parameter.db_password.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_ssm" {
  name   = "sns-app-fargate-task-execution-ssm-access"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.ecs_task_execution_ssm.json
}

# --- タスクロール(アプリケーション自身の権限) ---

resource "aws_iam_role" "ecs_task" {
  name               = "sns-app-fargate-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}
