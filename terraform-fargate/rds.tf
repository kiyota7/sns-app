# RDS(PostgreSQL)。既存EC2構成のSQLite(EC2ローカルディスク)を置き換えるもの
# ——ECS Fargateはタスクの再起動・デプロイのたびにローカルディスクの中身が
# 失われるステートレスな実行環境のため、SQLiteのようなファイルベースのDBは使えない。
#
# コスト最小化のため: 最小インスタンスクラス・Single-AZ・最小ストレージ・
# 削除保護なし・最終スナップショット無しにしている(既存terraform/s3.tfの
# 「気軽に畳める」方針をRDSにも適用)。

resource "random_password" "db" {
  length = 24
  # RDSのPostgreSQLパスワードは "/" "@" """ " " 等の一部記号を許可しないため、
  # 記号は使わずランダム性を文字種で確保する。
  special = false
}

resource "aws_db_subnet_group" "this" {
  name       = "sns-app-fargate-db-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "sns-app-fargate-db-subnet-group"
  }
}

resource "aws_db_instance" "this" {
  identifier = "sns-app-fargate-db"

  engine = "postgres"
  # RDSは特定のマイナーバージョンを順次廃止するため、applyする前に
  # `aws rds describe-db-engine-versions --engine postgres --query "DBEngineVersions[].EngineVersion"`
  # で利用可能なバージョンを確認し、必要であればこの値を調整すること。
  engine_version = "16.4"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  multi_az               = false
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true
  deletion_protection = false
  apply_immediately   = true

  tags = {
    Name = "sns-app-fargate-db"
  }
}
