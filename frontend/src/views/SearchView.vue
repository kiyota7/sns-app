<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, users, AuthExpiredError } from '../lib/api'

const router = useRouter()
const currentUser = ref(auth.getUser())
const searchQuery = ref('')
const results = ref([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(() => search(''))

async function search(query) {
  loading.value = true
  errorMessage.value = ''
  try {
    results.value = await users.search(query)
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      router.push({ name: 'login' })
      return
    }
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

function handleSubmit() {
  search(searchQuery.value.trim())
}

async function toggleFollow(result) {
  errorMessage.value = ''
  try {
    const updated = await users.toggleFollow(result.id)
    result.following = updated.following
  } catch (error) {
    errorMessage.value = error.message
  }
}

function handleBack() {
  router.push({ name: 'timeline' })
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-title">(仮称)SNS</div>
    <nav class="app-header-nav">
      <RouterLink class="user-chip" :to="`/users/${currentUser?.id}`">{{ currentUser?.username }}</RouterLink>
      <button type="button" class="btn btn-outline" @click="handleLogout">ログアウト</button>
    </nav>
  </header>

  <div class="page">
    <button type="button" class="back-link" @click="handleBack">← 戻る</button>

    <form class="search-bar" @submit.prevent="handleSubmit">
      <input type="text" v-model="searchQuery" placeholder="ユーザー名で検索" />
      <button type="submit" class="btn btn-small">検索</button>
    </form>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <p v-else-if="loading">読み込み中...</p>
    <div v-else-if="results.length === 0" class="empty-state">該当する利用者が見つかりません。</div>
    <template v-else>
      <div v-for="result in results" :key="result.id" class="search-result-row">
        <RouterLink class="search-result-name" :to="`/users/${result.id}`">{{ result.username }}</RouterLink>
        <button
          type="button"
          class="btn btn-small"
          :class="{ 'btn-outline': result.following }"
          @click="toggleFollow(result)"
        >
          {{ result.following ? 'フォロー中' : 'フォローする' }}
        </button>
      </div>
    </template>
  </div>
</template>
