<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import App from './App.vue'
import LandingSharePage from './pages/LandingSharePage.vue'
import LetterPage from './pages/LetterPage.vue'

const route = ref(window.location.hash || '#/')

const syncRoute = () => {
  route.value = window.location.hash || '#/'
}

onMounted(() => {
  window.addEventListener('hashchange', syncRoute)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute)
})

const pageName = computed(() => {
  if (route.value === '#/letter') return 'letter'
  if (route.value === '#/share') return 'share'
  return 'home'
})
</script>

<template>
  <LetterPage v-if="pageName === 'letter'" />
  <LandingSharePage v-else-if="pageName === 'share'" />
  <App v-else />
</template>
