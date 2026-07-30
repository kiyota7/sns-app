<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, AuthExpiredError } from '../lib/api'

const router = useRouter()
const user = ref(auth.getUser())
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    user.value = await auth.me()
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      router.push({ name: 'login' })
      return
    }
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
})

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="welcome-page">
    <h1>ログイン成功</h1>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <p v-else-if="loading">確認中...</p>
    <p v-else>ようこそ、{{ user?.username }} さん</p>
    <button type="button" class="btn btn-outline" @click="handleLogout">ログアウト</button>
  </div>
</template>
