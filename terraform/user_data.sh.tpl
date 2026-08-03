#!/bin/bash
set -eux

# --- スワップ領域の作成 ---
# t3.micro等の無料利用枠インスタンスはメモリが1GBしかなく、
# Maven/npmのビルドがメモリ不足で失敗しないようにスワップを追加する。
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# --- Docker / Git の導入 ---
# Amazon Linux 2023のdnfリポジトリには docker-compose-plugin パッケージが存在しないため、
# Docker Compose(v2)は公式GitHubリリースのバイナリをCLIプラグインとして直接配置する。
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# --- アプリの取得(Private repoのため認証付きURLでclone) ---
mkdir -p /opt/app
cd /opt/app
if [ ! -d .git ]; then
  git clone --branch "${repo_branch}" "${repo_clone_url}" .
fi

# --- SQLiteのDBファイル・投稿画像を永続化するディレクトリ ---
# docker-compose.prod.ymlが ./data をマウントする。git pullでは削除されない。
mkdir -p /opt/app/data

# --- .env の生成(JWT署名シークレット・S3設定。リポジトリにコミットしない) ---
cat > /opt/app/.env <<EOF
JWT_SECRET=${jwt_secret}
APP_STORAGE_TYPE=s3
AWS_S3_BUCKET=${s3_bucket_name}
AWS_REGION=${aws_region}
EOF
chmod 600 /opt/app/.env

# --- 初回起動 ---
cd /opt/app
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
