<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { loveLetterText } from '../data/loveLetter'

const text = loveLetterText
const typedLength = ref(0)
const revealStage = ref('enter')
const musicEnabled = ref(false)
const musicReady = ref(false)
const canClose = ref(false)

let introTimer = 0
let typingTimer = 0
let audioContext
let masterGain
let musicNodes = []
let musicLoopTimer = 0

const typedText = computed(() => text.slice(0, typedLength.value))

const stopMusic = () => {
  clearTimeout(musicLoopTimer)
  musicLoopTimer = 0
  musicNodes.forEach((node) => node.stop?.())
  musicNodes = []
  masterGain?.disconnect()
  masterGain = null
  audioContext?.close?.()
  audioContext = null
  musicReady.value = false
  musicEnabled.value = false
}

const startMusic = async () => {
  if (musicReady.value) return

  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  masterGain = audioContext.createGain()
  masterGain.gain.value = 0.08
  masterGain.connect(audioContext.destination)

  const scale = [0, 3, 7, 10, 12, 10, 7, 3]
  const base = 220
  let step = 0

  const loop = () => {
    if (!audioContext || audioContext.state === 'closed') return

    const startTime = audioContext.currentTime + 0.02
    scale.forEach((offset, index) => {
      const osc = audioContext.createOscillator()
      const filter = audioContext.createBiquadFilter()
      const gain = audioContext.createGain()

      osc.type = index % 2 === 0 ? 'triangle' : 'sine'
      osc.frequency.value = base * Math.pow(2, offset / 12)
      filter.type = 'lowpass'
      filter.frequency.value = 980 + index * 90
      gain.gain.setValueAtTime(0.0001, startTime + index * 0.45)
      gain.gain.exponentialRampToValueAtTime(0.14, startTime + index * 0.45 + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.45 + 0.55)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(masterGain)
      osc.start(startTime + index * 0.45)
      osc.stop(startTime + index * 0.45 + 0.62)
      musicNodes.push(osc)
    })

    const nextDelay = 3.7
    musicLoopTimer = window.setTimeout(() => {
      if (audioContext && audioContext.state !== 'closed') {
        loop()
      }
    }, nextDelay * 1000)

    step += 1
  }

  await audioContext.resume()
  musicReady.value = true
  musicEnabled.value = true
  loop()
}

const handleStart = async () => {
  await startMusic()
}

const revealLetter = () => {
  clearInterval(typingTimer)
  typedLength.value = 0
  revealStage.value = 'typing'

  typingTimer = window.setInterval(() => {
    typedLength.value += 2
    if (typedLength.value >= text.length) {
      typedLength.value = text.length
      clearInterval(typingTimer)
      revealStage.value = 'done'
      canClose.value = true
    }
  }, 26)
}

onMounted(() => {
  introTimer = window.setTimeout(() => {
    revealStage.value = 'open'
    revealLetter()
  }, 900)

  handleStart().catch(() => {
    musicReady.value = false
    musicEnabled.value = false
  })
})

onBeforeUnmount(() => {
  clearTimeout(introTimer)
  clearInterval(typingTimer)
  stopMusic()
})
</script>

<template>
  <main class="letter-page" :class="`stage-${revealStage}`">
    <div class="backdrop"></div>
    <section class="paper-shell">
      <header class="topbar">
        <button class="music-btn" type="button" @click="handleStart">
          {{ musicEnabled ? '背景音乐' : '开启音乐' }}
        </button>
      </header>

      <article class="paper">
        <span class="line line-1"></span>
        <span class="line line-2"></span>
        <span class="line line-3"></span>
        <span class="line line-4"></span>
        <button class="seal" type="button" @click="handleStart">
          <span>{{ musicEnabled ? '已激活' : '点击激活' }}</span>
        </button>

        <div class="content">
          <p class="typewriter">{{ typedText }}<span v-if="revealStage === 'typing'" class="caret"></span></p>
        </div>
      </article>

      <p class="footer-note" :class="{ visible: canClose }">愿你打开时，刚好听见我想说的话。</p>
    </section>
  </main>
</template>

<style scoped>
.letter-page {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.82), transparent 32%),
    radial-gradient(circle at 82% 16%, rgba(246, 198, 196, 0.45), transparent 24%),
    linear-gradient(180deg, #646162 0%, #ece6dc 24%, #f7f3ec 100%);
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(32, 26, 29, 0.22), transparent 14%),
    radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.26), transparent 26%);
  opacity: 0.6;
}

.paper-shell {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  align-content: center;
  justify-items: center;
  padding: 28px 14px 36px;
}

.topbar {
  width: min(100%, 420px);
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.music-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  color: #5b4248;
  font-size: 13px;
  background: rgba(255, 250, 244, 0.9);
  box-shadow: 0 8px 18px rgba(56, 42, 48, 0.1);
}

.paper {
  position: relative;
  width: min(100%, 420px);
  min-height: min(78svh, 780px);
  overflow: hidden;
  border: 1px solid rgba(121, 97, 84, 0.16);
  border-radius: 12px;
  padding: 92px 22px 34px;
  background:
    repeating-linear-gradient(180deg, transparent 0 36px, rgba(135, 118, 103, 0.22) 37px 38px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 251, 245, 0.98));
  box-shadow:
    0 24px 68px rgba(71, 51, 54, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(18px) scale(0.94);
  opacity: 0;
  animation: paper-in 780ms ease forwards;
}

.letter-page.stage-typing .paper,
.letter-page.stage-done .paper {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(88, 83, 82, 0.26);
}

.line-1 { top: 88px; }
.line-2 { top: 140px; }
.line-3 { top: 192px; }
.line-4 { top: 244px; }

.seal {
  position: absolute;
  left: 14px;
  top: 18px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 38% 40%, rgba(255, 255, 255, 0.55), transparent 18%),
    linear-gradient(145deg, #736370, #52505d);
  box-shadow: 0 8px 18px rgba(64, 52, 60, 0.22);
  cursor: pointer;
}

.seal span {
  position: absolute;
  left: -6px;
  bottom: -8px;
  padding: 6px 10px;
  border-radius: 16px;
  color: #694a35;
  font-size: 12px;
  background: linear-gradient(180deg, #f8e1ba, #efd296);
  box-shadow: 0 8px 18px rgba(130, 100, 65, 0.18);
  white-space: nowrap;
}

.content {
  position: relative;
  z-index: 1;
  margin-top: 16px;
}

.typewriter {
  margin: 0;
  color: #7f3045;
  font-family: 'LXGW WenKai', 'KaiTi', 'STKaiti', serif;
  font-size: clamp(20px, 4.4vw, 27px);
  line-height: 1.88;
  white-space: pre-wrap;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 248, 240, 0.5);
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: #8b324f;
  vertical-align: -0.12em;
}

.footer-note {
  margin: 14px 0 0;
  color: rgba(255, 248, 246, 0.82);
  font-size: 13px;
  letter-spacing: 0.08em;
  opacity: 0;
  transform: translateY(8px);
  transition: 360ms ease;
}

.footer-note.visible {
  opacity: 1;
  transform: translateY(0);
}

@keyframes paper-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.92);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 420px) {
  .paper {
    padding-inline: 18px;
  }

  .seal {
    width: 66px;
    height: 66px;
  }
}
</style>
