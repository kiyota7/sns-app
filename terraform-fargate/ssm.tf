# JWT署名シークレット・DBパスワードをSSM Parameter Store(SecureString)に保存する。
# AWS Secrets Managerではなくこちらを選んでいるのは、Secrets Managerが
# シークレット1つあたり月額課金(~$0.40)なのに対し、SSM Parameter Storeの
# 標準パラメータ(SecureString含む)は無料のため(コスト最小化の方針に合わせる)。

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/sns-app-fargate/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret

  tags = {
    Name = "sns-app-fargate-jwt-secret"
  }
}

# DBパスワードは人間が選ぶ値ではなく、Terraformでランダム生成する(rds.tf参照)。
resource "aws_ssm_parameter" "db_password" {
  name  = "/sns-app-fargate/db-password"
  type  = "SecureString"
  value = random_password.db.result

  tags = {
    Name = "sns-app-fargate-db-password"
  }
}
