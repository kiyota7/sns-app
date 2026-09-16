#!/usr/bin/env bash
# backend/Dockerfileからイメージをビルドし、ECRへpushする。
#
# Terraformの null_resource/local-exec では管理しない: Dockerイメージの内容は
# Terraform stateで追跡するのに向いておらず(コード変更のたびに正しく
# 再トリガーされる保証が無い)、このリポジトリの既存の scripts/deploy.sh も
# 同様に「手動/スクリプト実行、Terraform管理外」という方針のため、それに揃える。
#
# 前提: `terraform apply -target=aws_ecr_repository.backend` (または
# フルapply)が既に一度実行され、ECRリポジトリが存在していること。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

REPO_URL="$(terraform output -raw ecr_repository_url)"
REGION="$(terraform output -raw aws_region)"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "[build-and-push] ECRリポジトリ: ${REPO_URL}"
echo "[build-and-push] リージョン: ${REGION}"
echo "[build-and-push] タグ: ${IMAGE_TAG}"

aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${REPO_URL%%/*}"

docker build -t "${REPO_URL}:${IMAGE_TAG}" "${SCRIPT_DIR}/../backend"
docker push "${REPO_URL}:${IMAGE_TAG}"

echo "[build-and-push] 完了: ${REPO_URL}:${IMAGE_TAG}"
echo "[build-and-push] 初回はこの後 'terraform apply' でECSサービス等を作成してください。"
echo "[build-and-push] 2回目以降(コード変更の反映)は、この後に以下を実行してください:"
echo "  aws ecs update-service --cluster \$(terraform output -raw ecs_cluster_name) \\"
echo "    --service \$(terraform output -raw ecs_service_name) --force-new-deployment"
