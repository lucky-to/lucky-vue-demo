<script setup>
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'

const qrUrl = ref('')
const shareUrl = ref('')

const buildShareUrl = () => {
  const { origin, pathname } = window.location
  const basePath = pathname.endsWith('/') ? pathname : pathname.slice(0, pathname.lastIndexOf('/') + 1)
  return `${origin}${basePath}#/letter`
}

onMounted(async () => {
  shareUrl.value = buildShareUrl()
  qrUrl.value = await QRCode.toDataURL(shareUrl.value, {
    margin: 1,
    width: 320,
    color: {
      dark: '#3d2b32',
      light: '#fffdf7',
    },
  })
})

const copyLink = async () => {
  if (!shareUrl.value) return
  await navigator.clipboard.writeText(shareUrl.value)
}
</script>

<template>
  <main class="share-page">
    <section class="share-card">
      <p class="eyebrow">扫码直达</p>
      <h1>一封会慢慢展开的信</h1>
      <p class="lead">
        把这个地址发给对方，打开后会先看到一段过渡动画，再进入打字机展示的告白页。
      </p>

      <div class="qr-wrap">
        <img v-if="qrUrl" :src="qrUrl" alt="告白页二维码" class="qr-image" />
        <div v-else class="qr-loading">二维码生成中...</div>
      </div>

      <div class="actions">
        <a class="primary" :href="shareUrl || '#/letter'">打开告白页</a>
        <button class="ghost" type="button" @click="copyLink">复制链接</button>
      </div>

      <p class="url">{{ shareUrl }}</p>
    </section>
  </main>
</template>

<style scoped>
.share-page {
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(255, 238, 230, 0.92), transparent 48%),
    linear-gradient(180deg, #f8efe7 0%, #f5f0ea 100%);
}

.share-card {
  width: min(100%, 520px);
  border: 1px solid rgba(90, 61, 66, 0.08);
  border-radius: 20px;
  padding: 28px 22px 24px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 60px rgba(78, 53, 58, 0.12);
}

.eyebrow {
  margin: 0 0 10px;
  color: #b06c70;
  font-size: 13px;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0;
  color: #33242a;
  font-size: clamp(28px, 6vw, 38px);
  line-height: 1.14;
}

.lead {
  margin: 14px 0 0;
  color: rgba(51, 36, 42, 0.76);
  font-size: 15px;
  line-height: 1.8;
}

.qr-wrap {
  display: grid;
  place-items: center;
  margin: 22px 0 18px;
  padding: 18px;
  border-radius: 18px;
  background: #fffdf8;
}

.qr-image,
.qr-loading {
  width: min(72vw, 280px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 12px;
}

.qr-image {
  background: #fffdf8;
}

.qr-loading {
  color: rgba(61, 43, 50, 0.56);
  background: #faf4ef;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary,
.ghost {
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 15px;
  line-height: 44px;
  cursor: pointer;
  text-decoration: none;
}

.primary {
  color: #fff;
  background: linear-gradient(135deg, #b65f67, #8f5f8e);
  box-shadow: 0 10px 22px rgba(163, 93, 113, 0.28);
}

.ghost {
  color: #5c4048;
  border: 1px solid rgba(92, 64, 72, 0.16);
  background: rgba(255, 255, 255, 0.82);
}

.url {
  margin: 16px 0 0;
  color: rgba(61, 43, 50, 0.6);
  font-size: 12px;
  word-break: break-all;
}
</style>
