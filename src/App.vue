<script setup>
import QRCode from 'qrcode'
import { computed, onMounted, ref, watch } from 'vue'
import loveSokobanSprites from './assets/game/love-sokoban-sprites.png'

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
const sokobanPassed = ref(false)
const sokobanMessage = ref('把礼物盒推到发光的心上，就能打开第一份礼物。')
const moveCount = ref(0)
const playerPosition = ref({ row: 4, col: 1 })
const boxes = ref([
  { id: 'box_1', row: 2, col: 2, placed: false },
  { id: 'box_2', row: 3, col: 3, placed: false },
])
const moveHistory = ref([])

const boardRows = 6
const boardCols = 6
const wallCells = ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5', '1-0', '1-5', '2-0', '2-5', '3-0', '3-5', '4-0', '4-5', '5-0', '5-1', '5-2', '5-3', '5-4', '5-5', '2-3']
const targetCells = ['1-4', '4-4']

const urlGiftKey = computed(() => new URLSearchParams(window.location.search).get('gift') || '')
const isGiftMode = computed(() => Boolean(urlGiftKey.value))
const needsChallenge = computed(() => urlGiftKey.value === 'gift_01')
const stars = computed(() => {
  if (!sokobanPassed.value) return 0
  if (moveCount.value <= 8) return 3
  if (moveCount.value <= 12) return 2
  return 1
})
const boardCells = computed(() => Array.from({ length: boardRows * boardCols }, (_, index) => {
  const row = Math.floor(index / boardCols)
  const col = index % boardCols
  const key = `${row}-${col}`
  const box = boxes.value.find((item) => item.row === row && item.col === col)

  return {
    key,
    row,
    col,
    isWall: wallCells.includes(key),
    isTarget: targetCells.includes(key),
    hasPlayer: playerPosition.value.row === row && playerPosition.value.col === col,
    box,
  }
}))
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

const completeSokoban = () => {
  sokobanPassed.value = true
}

const samePosition = (first, second) => first.row === second.row && first.col === second.col

const isOutside = (position) => (
  position.row < 0 ||
  position.row >= boardRows ||
  position.col < 0 ||
  position.col >= boardCols
)

const isWall = (position) => wallCells.includes(`${position.row}-${position.col}`)

const findBox = (position) => boxes.value.find((box) => samePosition(box, position))

const refreshBoxState = () => {
  boxes.value = boxes.value.map((box) => ({
    ...box,
    placed: targetCells.includes(`${box.row}-${box.col}`),
  }))
}

const movePlayer = (rowDelta, colDelta) => {
  if (sokobanPassed.value) return

  const nextPlayer = {
    row: playerPosition.value.row + rowDelta,
    col: playerPosition.value.col + colDelta,
  }

  if (isOutside(nextPlayer) || isWall(nextPlayer)) {
    sokobanMessage.value = '这边是墙，换个方向靠近礼物盒。'
    return
  }

  const pushedBox = findBox(nextPlayer)
  let nextBoxes = boxes.value.map((box) => ({ ...box }))

  if (pushedBox) {
    const nextBox = {
      row: pushedBox.row + rowDelta,
      col: pushedBox.col + colDelta,
    }

    if (isOutside(nextBox) || isWall(nextBox) || findBox(nextBox)) {
      sokobanMessage.value = '礼物盒被挡住啦，试试绕到另一边。'
      return
    }

    nextBoxes = nextBoxes.map((box) => (
      box.id === pushedBox.id ? { ...box, ...nextBox } : box
    ))
  }

  moveHistory.value.push({
    player: { ...playerPosition.value },
    boxes: boxes.value.map((box) => ({ ...box })),
    moveCount: moveCount.value,
    message: sokobanMessage.value,
  })
  playerPosition.value = nextPlayer
  boxes.value = nextBoxes
  moveCount.value += 1
  refreshBoxState()

  if (boxes.value.every((box) => box.placed)) {
    sokobanMessage.value = '通关成功，所有礼物都到达心动目标点啦。'
    completeSokoban()
    return
  }

  sokobanMessage.value = '很好，把两个礼物盒都推到星星目标点上。'
}

const undoMove = () => {
  const previous = moveHistory.value.pop()

  if (!previous) {
    sokobanMessage.value = '还没有可以撤销的步骤。'
    return
  }

  playerPosition.value = previous.player
  boxes.value = previous.boxes
  moveCount.value = previous.moveCount
  sokobanMessage.value = '已撤销上一步。'
}

const showHint = () => {
  sokobanMessage.value = '提示：先把右侧礼物盒推到下方星星，再处理上方礼物盒。'
}

const resetSokoban = () => {
  sokobanPassed.value = false
  sokobanMessage.value = '把礼物盒推到发光的心上，就能打开第一份礼物。'
  moveCount.value = 0
  playerPosition.value = { row: 4, col: 1 }
  boxes.value = [
    { id: 'box_1', row: 2, col: 2, placed: false },
    { id: 'box_2', row: 3, col: 3, placed: false },
  ]
  moveHistory.value = []
}

onMounted(() => {
  if (!isGiftMode.value) {
    baseUrl.value = `${window.location.origin}${window.location.pathname}`
  }
})
</script>

<template>
  <main v-if="isGiftMode" class="gift-shell" :style="{ '--gift-color': activeGift.color }">
    <section v-if="needsChallenge && !sokobanPassed" class="challenge-page">
      <div class="gift-number">Gift {{ activeGift.number }}</div>
      <h1>礼物通关大挑战</h1>
      <p class="gift-line">第一关：把所有礼物盒推到星星目标点，解锁第一份礼物。</p>

      <section class="game-phone">
        <header class="game-topbar">
          <button class="round-button" type="button" aria-label="暂停">Ⅱ</button>
          <span class="level-pill">关卡 01</span>
          <div class="star-row" aria-label="星级">
            <span v-for="item in 3" :key="item" :class="{ active: item <= stars }">★</span>
          </div>
          <button class="round-button" type="button" aria-label="设置">⚙</button>
        </header>

        <div class="game-board" :style="{ '--sprite-sheet': `url(${loveSokobanSprites})` }">
          <div
            v-for="cell in boardCells"
            :key="cell.key"
            class="game-cell"
            :class="{ wall: cell.isWall, target: cell.isTarget }"
          >
            <span v-if="cell.isTarget" class="tile-star">★</span>
            <span v-if="cell.box" class="sprite box-sprite" :class="{ placed: cell.box.placed }"></span>
            <span v-if="cell.hasPlayer" class="sprite player-sprite"></span>
          </div>
        </div>

        <div class="game-message">
          <strong>步数：{{ moveCount }}</strong>
          <p>{{ sokobanMessage }}</p>
        </div>
      </section>

      <div class="sokoban-controls" aria-label="移动控制">
        <button class="up" type="button" @click="movePlayer(-1, 0)">上</button>
        <button class="left" type="button" @click="movePlayer(0, -1)">左</button>
        <button class="right" type="button" @click="movePlayer(0, 1)">右</button>
        <button class="down" type="button" @click="movePlayer(1, 0)">下</button>
      </div>

      <div class="challenge-actions">
        <button class="secondary-button" type="button" @click="undoMove">撤销</button>
        <button class="secondary-button" type="button" @click="resetSokoban">重新开始</button>
        <button class="secondary-button" type="button" @click="showHint">提示</button>
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
