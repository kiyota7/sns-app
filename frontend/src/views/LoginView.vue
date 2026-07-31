<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../lib/api'

const router = useRouter()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await auth.login({ email: email.value, password: password.value })
    router.push({ name: 'timeline' })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <h1>(仮称)SNS</h1>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <form @submit.prevent="handleSubmit">
      <div class="form-row">
        <label for="login-email">メールアドレス</label>
        <input id="login-email" v-model="email" type="email" required />
      </div>
      <div class="form-row">
        <label for="login-password">パスワード</label>
        <input id="login-password" v-model="password" type="password" required />
      </div>
      <button type="submit" class="btn btn-block" :disabled="submitting">ログイン</button>
    </form>
    <div class="switch-link">
      アカウントをお持ちでない方は <RouterLink to="/signup">新規登録</RouterLink>
    </div>
  </div>
</template>
