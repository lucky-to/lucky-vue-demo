<script setup>
import QRCode from 'qrcode'
import { computed, onMounted, ref, watch } from 'vue'

const gifts = {
  gift_01: {
    number: '01',
    title: '第一份礼物',
    line: '这是今天的第一颗小心意。',
    message: '我想把最先出现的惊喜留给你。不是因为它最贵重，而是因为我想让你一打开这个小世界，就知道有人很认真地把你放在心上。',
    promise: '以后每一个普通日子，我也想这样认真地喜欢你。',
    color: '#e11d48',
  },
  gift_02: {
    number: '02',
    title: '第二份礼物',
    line: '这里藏着一句只给你的话。',
    message: '如果今天有很多热闹，那我希望这一刻可以慢一点。你不用马上说什么，只要知道，我喜欢你的样子，喜欢你出现以后我生活里多出来的光。',
    promise: '愿你每次扫码，都像拆开一封新的情书。',
    color: '#db2777',
  },
  gift_03: {
    number: '03',
    title: '第三份礼物',
    line: '这是属于我们的一个小暗号。',
    message: '以后看到这个二维码，你就可以想到：有人偷偷准备过这些小机关，只为了让你笑一下。这个人就是我，而且会一直是我。',
    promise: '希望我能成为你生活里稳定又温柔的惊喜。',
    color: '#7c3aed',
  },
}

const defaultBaseUrl = 'https://lucky-to.github.io/lucky-vue-demo/'
const baseUrl = ref(defaultBaseUrl)
const giftKey = ref('gift_01')
const customKey = ref('')
const qrCodeUrl = ref('')
const copied = ref(false)
const draggedIndex = ref(null)
const puzzlePassed = ref(false)
const puzzleMessage = ref('把碎片拖到正确顺序，拼出藏在第一份礼物前的那句话。')

const correctPuzzleOrder = ['piece_01', 'piece_02', 'piece_03', 'piece_04', 'piece_05', 'piece_06']
const selectedOrder = ref(['piece_04', 'piece_07', 'piece_01', 'piece_06', 'piece_03', 'piece_02', 'piece_05'])
const puzzlePieces = [
  { id: 'piece_01', text: '遇见你以后，' },
  { id: 'piece_02', text: '普通的' },
  { id: 'piece_03', text: '日子' },
  { id: 'piece_04', text: '也' },
  { id: 'piece_05', text: '开始' },
  { id: 'piece_06', text: '发光。' },
  { id: 'piece_07', text: '今天先不告诉你答案' },
]

const urlGiftKey = computed(() => new URLSearchParams(window.location.search).get('gift') || '')
const isGiftMode = computed(() => Boolean(urlGiftKey.value))
const needsChallenge = computed(() => urlGiftKey.value === 'gift_01')
const orderedPuzzlePieces = computed(() => selectedOrder.value.map((id) => puzzlePieces.find((piece) => piece.id === id)))
const activeGift = computed(() => gifts[urlGiftKey.value] || {
  number: '?',
  title: '一份还没写好的礼物',
  line: '这个二维码已经被打开啦。',
  message: `当前礼物标识是 ${urlGiftKey.value}，但项目里还没有为它写内容。可以在 gifts 配置里加上这一份礼物的专属文案。`,
  promise: '下一次打开这里，就让它变成一个真正的惊喜。',
  color: '#475569',
})

const selectedGiftKey = computed(() => customKey.value.trim() || giftKey.value)
const generatedUrl = computed(() => {
  const url = new URL(baseUrl.value || defaultBaseUrl)
  url.searchParams.set('gift', selectedGiftKey.value)
  return url.toString()
})

watch(generatedUrl, async (value) => {
  qrCodeUrl.value = await QRCode.toDataURL(value, {
    width: 280,
    margin: 2,
    color: {
      dark: '#3f1d2b',
      light: '#fff7fb',
    },
  })
}, { immediate: true })

const copyUrl = async () => {
  await navigator.clipboard.writeText(generatedUrl.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

const movePiece = (fromIndex, toIndex) => {
  if (toIndex < 0 || toIndex >= selectedOrder.value.length || fromIndex === toIndex) {
    return
  }

  const nextOrder = [...selectedOrder.value]
  const [piece] = nextOrder.splice(fromIndex, 1)
  nextOrder.splice(toIndex, 0, piece)
  selectedOrder.value = nextOrder
  puzzleMessage.value = '顺序已经调整啦，再确认一下这句话是不是读得通。'
}

const startDrag = (index) => {
  draggedIndex.value = index
}

const dropPiece = (index) => {
  if (draggedIndex.value === null) {
    return
  }

  movePiece(draggedIndex.value, index)
  draggedIndex.value = null
}

const checkPuzzle = () => {
  const answer = selectedOrder.value.slice(0, correctPuzzleOrder.length)
  const hasOnlyCorrectPieces = !selectedOrder.value.slice(0, correctPuzzleOrder.length).includes('piece_07')

  if (hasOnlyCorrectPieces && answer.join('|') === correctPuzzleOrder.join('|')) {
    puzzlePassed.value = true
    puzzleMessage.value = '通关成功。第一份礼物已经打开啦。'
    return
  }

  puzzleMessage.value = '还差一点点。那句完整的话，应该像一句轻轻念出来的告白。'
}

const resetPuzzle = () => {
  selectedOrder.value = ['piece_04', 'piece_07', 'piece_01', 'piece_06', 'piece_03', 'piece_02', 'piece_05']
  draggedIndex.value = null
  puzzleMessage.value = '已恢复初始顺序，重新拼一次吧。'
}

onMounted(() => {
  if (!isGiftMode.value) {
    baseUrl.value = `${window.location.origin}${window.location.pathname}`
  }
})
</script>

<template>
  <main v-if="isGiftMode" class="gift-shell" :style="{ '--gift-color': activeGift.color }">
    <section v-if="needsChallenge && !puzzlePassed" class="challenge-page">
      <div class="gift-number">Gift {{ activeGift.number }}</div>
      <h1>礼物通关大挑战</h1>
      <p class="gift-line">第一关：拼出一句情书。提示：有一块碎片是来捣乱的。</p>

      <div class="challenge-card">
        <span>通关目标</span>
        <strong>遇见你以后，普通的日子也开始发光。</strong>
        <p>{{ puzzleMessage }}</p>
      </div>

      <div class="puzzle-board" aria-label="情书碎片排序区">
        <article
          v-for="(piece, index) in orderedPuzzlePieces"
          :key="piece.id"
          class="puzzle-piece"
          :class="{ decoy: piece.id === 'piece_07', dragging: draggedIndex === index }"
          draggable="true"
          @dragstart="startDrag(index)"
          @dragover.prevent
          @drop="dropPiece(index)"
          @dragend="draggedIndex = null"
        >
          <span>{{ index + 1 }}</span>
          <p>{{ piece.text }}</p>
          <div class="piece-actions">
            <button type="button" :disabled="index === 0" @click="movePiece(index, index - 1)">上移</button>
            <button type="button" :disabled="index === selectedOrder.length - 1" @click="movePiece(index, index + 1)">下移</button>
          </div>
        </article>
      </div>

      <div class="challenge-actions">
        <button type="button" @click="checkPuzzle">确认答案</button>
        <button class="secondary-button" type="button" @click="resetPuzzle">重新打乱</button>
      </div>
    </section>

    <section v-else class="gift-page">
      <div class="gift-number">Gift {{ activeGift.number }}</div>
      <h1>{{ activeGift.title }}</h1>
      <p class="gift-line">{{ activeGift.line }}</p>

      <article class="letter-card">
        <p>{{ activeGift.message }}</p>
        <strong>{{ activeGift.promise }}</strong>
      </article>

      <div class="signature">
        <span>From</span>
        <strong>一个很喜欢你的人</strong>
      </div>
    </section>
  </main>

  <main v-else class="studio-shell">
    <section class="hero">
      <p class="eyebrow">Gift QR Studio</p>
      <h1>给每份礼物贴上一句只属于她的话</h1>
      <p>选择礼物编号，生成二维码。她扫码后会进入对应的甜蜜页面，看到你提前藏好的心意。</p>
    </section>

    <section class="workspace">
      <form class="panel" @submit.prevent>
        <label>
          <span>访问地址</span>
          <input v-model="baseUrl" type="url" placeholder="https://lucky-to.github.io/lucky-vue-demo/" />
        </label>

        <label>
          <span>选择礼物</span>
          <select v-model="giftKey">
            <option v-for="gift in Object.keys(gifts)" :key="gift" :value="gift">{{ gift }}</option>
          </select>
        </label>

        <label>
          <span>自定义礼物标识</span>
          <input v-model="customKey" type="text" placeholder="例如 gift_ring / gift_flower" />
        </label>

        <div class="url-box">
          <span>二维码里的地址</span>
          <code>{{ generatedUrl }}</code>
        </div>

        <button type="button" @click="copyUrl">{{ copied ? '已复制' : '复制这个地址' }}</button>
      </form>

      <aside class="qr-card">
        <div class="qr-frame">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="Gift QR code" />
        </div>
        <p>把这个二维码保存或截图，打印后贴在对应礼物上。</p>
      </aside>
    </section>
  </main>
</template>
