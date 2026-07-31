<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../lib/api'

const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await auth.register({ username: username.value, email: email.value, password: password.value })
    router.push({ name: 'welcome' })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <h1>新規登録</h1>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <form @submit.prevent="handleSubmit">
      <div class="form-row">
        <label for="signup-username">ユーザー名</label>
        <input id="signup-username" v-model="username" type="text" required maxlength="50" />
      </div>
      <div class="form-row">
        <label for="signup-email">メールアドレス</label>
        <input id="signup-email" v-model="email" type="email" required />
      </div>
      <div class="form-row">
        <label for="signup-password">パスワード</label>
        <input id="signup-password" v-model="password" type="password" required minlength="8" />
      </div>
      <button type="submit" class="btn btn-block" :disabled="submitting">登録する</button>
    </form>
    <div class="switch-link">
      アカウントをお持ちの方は <RouterLink to="/">ログイン</RouterLink>
    </div>
  </div>
</template>
