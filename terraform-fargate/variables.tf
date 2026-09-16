variable "aws_region" {
  description = "デプロイ先のAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "jwt_secret" {
  description = "本番用JWT署名シークレット。terraform.tfvarsで上書きし、コミットしないこと"
  type        = string
  sensitive   = true
}

variable "allowed_http_cidr" {
  description = "ALB(80番ポート)へのアクセスを許可するCIDR"
  type        = string
  default     = "0.0.0.0/0"
}

variable "db_username" {
  description = "RDS(PostgreSQL)のマスターユーザー名"
  type        = string
  default     = "snsapp"
}

variable "db_name" {
  description = "RDS(PostgreSQL)上に作成するデータベース名"
  type        = string
  default     = "snsapp"
}

# DBパスワードはterraform.tfvarsで人間が指定するものではなく、
# random_password(rds.tf参照)でTerraformが生成しSSM Parameter Storeに保存する。
# ここでは変数化していない(既存terraform/のjwt_secretのような
# 「人間が選ぶ値」ではなく「生成すればよい値」のため)。

variable "container_image_tag" {
  description = "ECSタスク定義が参照するECRイメージタグ。build-and-push.shでpushしたタグを指定する"
  type        = string
  default     = "latest"
}
