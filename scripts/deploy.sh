#!/bin/bash
# コード変更後の再デプロイ用スクリプト。
# AWSマネジメントコンソールやSSHを使わず、AWS CLI(SSM Run Command)経由で
# EC2上の最新コードを取得し、Dockerコンテナを再ビルド・再起動する。
#
# 前提: terraform apply 済みで、terraform/ ディレクトリでこのスクリプトを実行できる状態であること。

set -euo pipefail

cd "$(dirname "$0")/../terraform"

INSTANCE_ID=$(terraform output -raw instance_id)

echo "Deploying to instance: ${INSTANCE_ID}"

aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "sns-app redeploy" \
  --parameters 'commands=[
    "cd /opt/app",
    "git pull",
    "docker compose -f docker-compose.prod.yml --env-file .env up -d --build"
  ]' \
  --output text
