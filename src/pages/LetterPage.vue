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

const toggleMusic = async () => {
  if (musicEnabled.value) {
    stopMusic()
    return
  }

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

  startMusic().catch(() => {
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
        <button class="music-btn" type="button" @click="toggleMusic">
          {{ musicEnabled ? '♪' : '♫' }}
        </button>
      </header>

      <article class="paper">
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
  overflow: hidden auto;
  color: #82364a;
  background:
    linear-gradient(180deg, rgba(60, 57, 57, 0.7) 0 72px, transparent 72px),
    linear-gradient(90deg, rgba(46, 38, 37, 0.1), transparent 12%, transparent 88%, rgba(46, 38, 37, 0.1)),
    #f2eee6;
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.28), transparent 18%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.54), rgba(255, 255, 255, 0));
  opacity: 0.42;
  pointer-events: none;
}

.paper-shell {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 100svh;
  justify-items: stretch;
  padding: 72px 0 0;
}

.topbar {
  position: fixed;
  right: 16px;
  top: 18px;
  z-index: 5;
}

.music-btn {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  color: #8e3c51;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 19px;
  background: rgba(255, 253, 248, 0.88);
  box-shadow: 0 8px 20px rgba(49, 37, 40, 0.14);
  cursor: pointer;
}

.paper {
  position: relative;
  width: min(100%, 460px);
  min-height: calc(100svh - 72px);
  margin: 0 auto;
  overflow: visible;
  border: 0;
  border-radius: 0;
  padding: 78px clamp(22px, 7vw, 44px) 72px;
  background:
    repeating-linear-gradient(180deg, transparent 0 43px, rgba(92, 86, 78, 0.26) 44px 45px),
    linear-gradient(180deg, #fffefb, #fffaf2 100%);
  box-shadow:
    0 0 0 1px rgba(90, 82, 72, 0.06),
    0 16px 44px rgba(57, 45, 45, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(16px);
  opacity: 0;
  animation: paper-in 720ms ease forwards;
}

.letter-page.stage-typing .paper,
.letter-page.stage-done .paper {
  opacity: 1;
  transform: translateY(0);
}

.content {
  position: relative;
  z-index: 1;
  margin: 0;
}

.typewriter {
  margin: 0;
  color: #923145;
  font-family: 'LXGW WenKai', 'KaiTi', 'STKaiti', serif;
  font-size: clamp(18px, 4.4vw, 23px);
  font-weight: 500;
  line-height: 2.08;
  white-space: pre-wrap;
  text-align: center;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-shadow: none;
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
  width: min(100%, 480px);
  margin: 12px auto 28px;
  color: rgba(128, 72, 83, 0.58);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-align: center;
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
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 420px) {
  .paper {
    width: calc(100% - 18px);
    padding-inline: 20px;
  }

  .typewriter {
    font-size: 19px;
  }
}
</style>
