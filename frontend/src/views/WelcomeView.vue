<script setup>
import { useRouter } from 'vue-router'
import { auth } from '../lib/api'

const router = useRouter()
const user = auth.getUser()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="welcome-page">
    <h1>ログイン成功</h1>
    <p>ようこそ、{{ user?.username }} さん</p>
    <button type="button" class="btn btn-outline" @click="handleLogout">ログアウト</button>
  </div>
</template>
