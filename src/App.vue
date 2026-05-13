<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const letterText = `今天这个箱子，不只是礼物。

是我偷偷准备了很久的一点点心意，
想把见到你之前的期待，
都认真地放进这里。

希望你打开它的时候，
能感觉到我真的很想见你，
也真的很喜欢你。`

const canvasRef = ref(null)
const envelopeHotspotRef = ref(null)
const stage = ref('intro')
const typedLength = ref(0)
const hasDragged = ref(false)

let renderer
let scene
let camera
let boxGroup
let envelopeGroup
let animationFrame = 0
let introTimer = 0
let typeTimer = 0
let resizeObserver
let isDragging = false
let previousPointer = { x: 0, y: 0 }
let targetRotation = { x: -0.2, y: -0.42 }
let currentRotation = { x: -0.2, y: -0.42 }
let introStart = 0
let cameraLookAt = new THREE.Vector3(0, 0.16, 0)
const introDuration = 3800

const introCameraPath = [
  {
    t: 0,
    position: new THREE.Vector3(0, 5.55, 5.08),
    lookAt: new THREE.Vector3(0, 0.3, 0.02),
    fov: 42,
  },
  {
    t: 0.46,
    position: new THREE.Vector3(0, 3.12, 5.96),
    lookAt: new THREE.Vector3(0, 0.36, 0.02),
    fov: 42,
  },
  {
    t: 0.76,
    position: new THREE.Vector3(0, 1.88, 6.32),
    lookAt: new THREE.Vector3(0, 0.18, 0),
    fov: 42,
  },
  {
    t: 1,
    position: new THREE.Vector3(0, 1.36, 6.48),
    lookAt: new THREE.Vector3(0, 0.04, 0),
    fov: 42,
  },
]

const smoothStep = (value) => value * value * (3 - 2 * value)

const applyIntroCamera = (progress) => {
  const nextIndex = introCameraPath.findIndex((point) => point.t >= progress)
  const endIndex = nextIndex === -1 ? introCameraPath.length - 1 : Math.max(1, nextIndex)
  const startFrame = introCameraPath[endIndex - 1]
  const endFrame = introCameraPath[endIndex]
  const segmentProgress = (progress - startFrame.t) / (endFrame.t - startFrame.t || 1)
  const eased = smoothStep(Math.max(0, Math.min(1, segmentProgress)))

  camera.position.lerpVectors(startFrame.position, endFrame.position, eased)
  cameraLookAt.lerpVectors(startFrame.lookAt, endFrame.lookAt, eased)
  camera.fov = startFrame.fov + (endFrame.fov - startFrame.fov) * eased
  camera.updateProjectionMatrix()
}

const typedText = computed(() => letterText.slice(0, typedLength.value))
const canOpenEnvelope = computed(() => stage.value === 'ready')
const isLetterOpen = computed(() => stage.value === 'opening' || stage.value === 'typing' || stage.value === 'done')

const updateEnvelopeHotspot = () => {
  if (!envelopeGroup || !camera || !canvasRef.value || !envelopeHotspotRef.value) return

  const vector = new THREE.Vector3()
  envelopeGroup.getWorldPosition(vector)
  vector.project(camera)

  const rect = canvasRef.value.getBoundingClientRect()
  const x = rect.left + ((vector.x + 1) / 2) * rect.width
  const y = rect.top + ((-vector.y + 1) / 2) * rect.height
  const isVisible = stage.value === 'ready' && vector.z < 1
  const hotspot = envelopeHotspotRef.value

  hotspot.style.left = `${x}px`
  hotspot.style.top = `${y}px`
  hotspot.style.opacity = isVisible ? '1' : '0'
  hotspot.style.pointerEvents = isVisible ? 'auto' : 'none'
}

const beginTyping = () => {
  window.clearInterval(typeTimer)
  typedLength.value = 0
  stage.value = 'typing'

  typeTimer = window.setInterval(() => {
    typedLength.value += 1

    if (typedLength.value >= letterText.length) {
      window.clearInterval(typeTimer)
      stage.value = 'done'
    }
  }, 74)
}

const openEnvelope = () => {
  if (!canOpenEnvelope.value) return

  stage.value = 'opening'
  window.setTimeout(beginTyping, 960)
}

const drawCherry = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#87aebc'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.quadraticCurveTo(12, -34, 34, -36)
  ctx.stroke()
  ctx.fillStyle = '#d97773'
  ctx.beginPath()
  ctx.arc(-12, 2, 16, 0, Math.PI * 2)
  ctx.arc(16, 4, 17, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.48)'
  ctx.beginPath()
  ctx.arc(-18, -4, 5, 0, Math.PI * 2)
  ctx.arc(9, -3, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const drawApple = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#d97773'
  ctx.beginPath()
  ctx.arc(-10, 4, 15, 0, Math.PI * 2)
  ctx.arc(10, 4, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7fae9b'
  ctx.beginPath()
  ctx.ellipse(10, -16, 13, 7, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#8f6f57'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.quadraticCurveTo(0, -20, 8, -25)
  ctx.stroke()
  ctx.restore()
}

const drawCoffee = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f1c9b5'
  ctx.strokeStyle = '#8bb0bf'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.roundRect(-34, -16, 62, 34, 12)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(34, 0, 14, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
  ctx.fillStyle = '#8e644f'
  ctx.beginPath()
  ctx.ellipse(-4, -8, 22, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e5c982'
  ctx.beginPath()
  ctx.ellipse(0, 22, 54, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#d97773'
  ctx.lineWidth = 4
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath()
    ctx.moveTo(-22 + i * 18, -34)
    ctx.quadraticCurveTo(-30 + i * 18, -46, -18 + i * 18, -58)
    ctx.stroke()
  }
  ctx.restore()
}

const drawCupcake = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#c9b1df'
  ctx.beginPath()
  ctx.moveTo(-32, 18)
  ctx.lineTo(32, 18)
  ctx.lineTo(20, 54)
  ctx.lineTo(-20, 54)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f4a9bd'
  ctx.beginPath()
  ctx.arc(-18, 8, 20, Math.PI, Math.PI * 2)
  ctx.arc(4, 2, 24, Math.PI, Math.PI * 2)
  ctx.arc(24, 12, 18, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#d74f69'
  ctx.beginPath()
  ctx.arc(18, -22, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7d5b51'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(18, -30)
  ctx.quadraticCurveTo(26, -44, 38, -40)
  ctx.stroke()
  ctx.restore()
}

const drawPaw = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#91b7c5'
  ctx.globalAlpha = 0.72
  ctx.beginPath()
  ctx.ellipse(0, 18, 17, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ;[[-22, -2], [-7, -14], [9, -14], [24, -2]].forEach(([px, py]) => {
    ctx.beginPath()
    ctx.arc(px, py, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1
  ctx.restore()
}

const drawBow = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#9fd7c4'
  ctx.strokeStyle = '#7ab19f'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(-22, 0, 25, 18, -0.35, 0, Math.PI * 2)
  ctx.ellipse(22, 0, 25, 18, 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7ab19f'
  ctx.beginPath()
  ctx.arc(0, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath()
    ctx.arc(-32 + i * 13, i % 2 ? -5 : 8, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const drawSprinkles = (ctx, count, seed = 1) => {
  const colors = ['#d85c73', '#7fb7d7', '#e5b943', '#80b946', '#e59b45', '#8d9de5']
  let value = seed
  for (let i = 0; i < count; i += 1) {
    value = (value * 9301 + 49297) % 233280
    const x = (value / 233280) * 1024
    value = (value * 9301 + 49297) % 233280
    const y = (value / 233280) * 1024
    value = (value * 9301 + 49297) % 233280
    const color = colors[value % colors.length]
    ctx.fillStyle = color
    ctx.globalAlpha = 0.82
    ctx.beginPath()
    ctx.roundRect(x, y, 12, 9, 4)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const drawDotGrid = (ctx) => {
  ctx.fillStyle = 'rgba(36, 43, 40, 0.5)'
  for (let y = 116; y < 970; y += 28) {
    for (let x = 58; x < 982; x += 28) {
      ctx.beginPath()
      ctx.arc(x, y, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const drawHandle = (ctx, x, y, scale = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f6f4ea'
  ctx.beginPath()
  ctx.roundRect(-116, -48, 232, 96, 44)
  ctx.fill()
  ctx.fillStyle = '#101315'
  ctx.beginPath()
  ctx.roundRect(-88, -24, 176, 48, 24)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.roundRect(-58, -34, 116, 13, 7)
  ctx.fill()
  ctx.restore()
}

const drawLidEdge = (ctx, withHandleNotches = false) => {
  ctx.fillStyle = '#f5efd9'
  ctx.fillRect(0, 0, 1024, 154)
  ctx.fillStyle = 'rgba(218, 207, 178, 0.35)'
  ctx.fillRect(0, 144, 1024, 12)
  drawSprinkles(ctx, 16, 17)

  if (withHandleNotches) {
    ctx.fillStyle = '#a49a84'
    ctx.beginPath()
    ctx.roundRect(122, 0, 118, 16, 6)
    ctx.roundRect(790, 0, 118, 16, 6)
    ctx.fill()
  }
}

const createLidSideTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f7efd8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let x = 0; x < canvas.width; x += 26) {
    ctx.strokeStyle = 'rgba(181, 165, 132, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 10, canvas.height)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(180, 159, 121, 0.26)'
  ctx.fillRect(0, 228, canvas.width, 12)

  const dots = [
    ['#d85c73', 78, 82], ['#7fb7d7', 210, 54], ['#e5b943', 356, 92],
    ['#80b946', 512, 66], ['#e59b45', 684, 92], ['#8d9de5', 842, 56],
    ['#d85c73', 946, 104],
  ]

  dots.forEach(([color, x, y]) => {
    ctx.fillStyle = color
    ctx.globalAlpha = 0.78
    ctx.beginPath()
    ctx.roundRect(x, y, 14, 10, 5)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createEnvelopeTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 760
  const ctx = canvas.getContext('2d')

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bg.addColorStop(0, '#fff7e8')
  bg.addColorStop(1, '#f4dfbf')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(139, 101, 68, 0.5)'
  ctx.lineWidth = 4
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36)

  ctx.save()
  ctx.shadowColor = 'rgba(113, 79, 49, 0.24)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#fff0d6'
  ctx.beginPath()
  ctx.moveTo(18, 18)
  ctx.quadraticCurveTo(52, 160, 178, 210)
  ctx.lineTo(700, 464)
  ctx.lineTo(1222, 210)
  ctx.quadraticCurveTo(1348, 160, 1382, 18)
  ctx.lineTo(18, 18)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(126, 89, 58, 0.56)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(18, 18)
  ctx.quadraticCurveTo(52, 160, 178, 210)
  ctx.lineTo(700, 464)
  ctx.lineTo(1222, 210)
  ctx.quadraticCurveTo(1348, 160, 1382, 18)
  ctx.stroke()

  drawSprinkles(ctx, 46, 121)

  ctx.fillStyle = '#75abc0'
  ctx.font = '700 70px "Comic Sans MS", "Trebuchet MS", sans-serif'
  ctx.save()
  ctx.translate(624, 172)
  ctx.rotate(0.06)
  ctx.fillText('Lucky Puppy', -210, 0)
  ctx.restore()

  ctx.strokeStyle = 'rgba(126, 89, 58, 0.26)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(18, 742)
  ctx.lineTo(520, 434)
  ctx.moveTo(1382, 742)
  ctx.lineTo(880, 434)
  ctx.stroke()

  drawPuppy(ctx, 700, 302, 1.1, 'float')
  drawPuppy(ctx, 290, 560, 0.78, 'headphone')
  drawPuppy(ctx, 1080, 520, 0.76, 'scarf')
  drawCherry(ctx, 300, 160, 0.8)
  drawApple(ctx, 1172, 170, 0.64)
  drawCoffee(ctx, 164, 642, 0.58)
  drawCupcake(ctx, 488, 636, 0.52)
  drawPaw(ctx, 430, 220, 0.62)
  drawPaw(ctx, 1086, 290, 0.62)
  drawStar(ctx, 468, 358, 40, 'rgba(229, 181, 64, 0.72)')
  drawStar(ctx, 360, 450, 56, 'rgba(229, 181, 64, 0.44)')
  drawBow(ctx, 812, 618, 0.52)
  drawCherry(ctx, 1244, 620, 0.62)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

const drawPuppy = (ctx, x, y, scale = 1, accessory = 'float') => {
  if (accessory === 'headphone') {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)

    const blush = ctx.createRadialGradient(-32, 6, 2, -32, 6, 18)
    blush.addColorStop(0, 'rgba(239, 129, 136, 0.78)')
    blush.addColorStop(1, 'rgba(239, 129, 136, 0)')
    const blushRight = ctx.createRadialGradient(32, 6, 2, 32, 6, 18)
    blushRight.addColorStop(0, 'rgba(239, 129, 136, 0.78)')
    blushRight.addColorStop(1, 'rgba(239, 129, 136, 0)')

    ctx.strokeStyle = '#cbb8aa'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.fillStyle = '#fffdf8'
    ctx.beginPath()
    ctx.ellipse(-34, -55, 18, 28, -0.42, 0, Math.PI * 2)
    ctx.ellipse(34, -55, 18, 28, 0.42, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#f6b6bd'
    ctx.beginPath()
    ctx.ellipse(-34, -55, 8, 16, -0.34, 0, Math.PI * 2)
    ctx.ellipse(34, -55, 8, 16, 0.34, 0, Math.PI * 2)
    ctx.fill()

    const headGradient = ctx.createLinearGradient(0, -82, 0, 58)
    headGradient.addColorStop(0, '#fffefa')
    headGradient.addColorStop(1, '#f3f7f5')
    ctx.fillStyle = headGradient
    ctx.beginPath()
    ctx.moveTo(-54, -44)
    ctx.bezierCurveTo(-62, -80, 62, -80, 54, -44)
    ctx.bezierCurveTo(72, 8, 46, 46, 0, 48)
    ctx.bezierCurveTo(-46, 46, -72, 8, -54, -44)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = '#82b5d5'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(0, -42, 54, Math.PI * 1.08, Math.PI * 1.92)
    ctx.stroke()

    const phoneGradient = ctx.createLinearGradient(-76, -24, 76, 28)
    phoneGradient.addColorStop(0, '#7fb5d8')
    phoneGradient.addColorStop(1, '#a8cdee')
    ctx.fillStyle = phoneGradient
    ctx.strokeStyle = '#77aaca'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(-76, -24, 28, 54, 14)
    ctx.roundRect(48, -24, 28, 54, 14)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(-65, -12, 5, 13, 0.25, 0, Math.PI * 2)
    ctx.ellipse(59, -12, 5, 13, -0.25, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = blush
    ctx.beginPath()
    ctx.arc(-32, 8, 19, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = blushRight
    ctx.beginPath()
    ctx.arc(32, 8, 19, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#263538'
    ctx.beginPath()
    ctx.arc(-20, -8, 5, 0, Math.PI * 2)
    ctx.arc(20, -8, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#4c352d'
    ctx.beginPath()
    ctx.ellipse(0, 6, 10, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#263538'
    ctx.beginPath()
    ctx.arc(-7, 1, 3, 0, Math.PI * 2)
    ctx.arc(7, 1, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f5b6bf'
    ctx.strokeStyle = '#dc9aa5'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(-54, 48, 88, 18, 9)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#f3c0c8'
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath()
      ctx.arc(-43 + i * 13, 57, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    const bodyGradient = ctx.createLinearGradient(0, 50, 0, 178)
    bodyGradient.addColorStop(0, '#fffdf8')
    bodyGradient.addColorStop(1, '#eef5f4')
    ctx.fillStyle = bodyGradient
    ctx.strokeStyle = '#cbb8aa'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-50, 58)
    ctx.bezierCurveTo(-72, 78, -78, 122, -62, 154)
    ctx.bezierCurveTo(-52, 174, -22, 174, -12, 152)
    ctx.bezierCurveTo(-6, 166, 8, 168, 16, 152)
    ctx.bezierCurveTo(28, 174, 60, 170, 68, 146)
    ctx.bezierCurveTo(78, 114, 66, 78, 48, 58)
    ctx.bezierCurveTo(32, 70, -30, 70, -50, 58)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = 'rgba(116, 163, 186, 0.38)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-36, 118)
    ctx.quadraticCurveTo(-42, 144, -30, 158)
    ctx.moveTo(-7, 118)
    ctx.quadraticCurveTo(-11, 145, -4, 160)
    ctx.moveTo(27, 116)
    ctx.quadraticCurveTo(32, 142, 22, 158)
    ctx.stroke()

    ctx.fillStyle = 'rgba(220, 235, 236, 0.42)'
    ctx.beginPath()
    ctx.ellipse(-48, 132, 13, 22, 0.18, 0, Math.PI * 2)
    ctx.ellipse(48, 132, 13, 22, -0.18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f5b6bf'
    ctx.strokeStyle = '#dc9aa5'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(52, 58, 22, 15, 0.35, 0, Math.PI * 2)
    ctx.ellipse(84, 55, 24, 16, -0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(64, 66, 18, 42, 9)
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = '#cbb8aa'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(58, 108)
    ctx.quadraticCurveTo(88, 94, 96, 124)
    ctx.stroke()

    drawStar(ctx, 102, 116, 18, '#e9ca75')

    ctx.restore()
    return
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)

  if (accessory === 'float') {
    ctx.fillStyle = '#b8cadf'
    ctx.beginPath()
    ctx.arc(0, 18, 64, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f5d888'
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6
      ctx.beginPath()
      ctx.arc(Math.cos(angle) * 45, 18 + Math.sin(angle) * 45, 11, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = '#fffaf1'
  ctx.strokeStyle = '#d9b8a7'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(-45, -18, 20, 32, -0.35, 0, Math.PI * 2)
  ctx.ellipse(45, -18, 20, 32, 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.roundRect(-56, -42, 112, 96, 44)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#fffaf1'
  ctx.beginPath()
  ctx.roundRect(-46, 40, 34, 46, 18)
  ctx.roundRect(12, 40, 34, 46, 18)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#293d43'
  ctx.beginPath()
  ctx.arc(-22, -10, 6, 0, Math.PI * 2)
  ctx.arc(22, -10, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f0a5a0'
  ctx.beginPath()
  ctx.arc(-34, 8, 12, 0, Math.PI * 2)
  ctx.arc(34, 8, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#2f4449'
  ctx.beginPath()
  ctx.ellipse(0, 6, 9, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2f4449'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 12)
  ctx.quadraticCurveTo(-8, 20, -18, 15)
  ctx.moveTo(0, 12)
  ctx.quadraticCurveTo(8, 20, 18, 15)
  ctx.stroke()

  if (accessory === 'headphone') {
    ctx.strokeStyle = '#82abc5'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(0, -22, 48, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
    ctx.fillStyle = '#82abc5'
    ctx.beginPath()
    ctx.roundRect(-68, -12, 22, 38, 11)
    ctx.roundRect(46, -12, 22, 38, 11)
    ctx.fill()
  }

  if (accessory === 'scarf') {
    ctx.fillStyle = '#d8898b'
    ctx.beginPath()
    ctx.roundRect(-38, 43, 76, 16, 8)
    ctx.fill()
  }

  ctx.restore()
}

const drawStar = (ctx, x, y, radius, color) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const pointRadius = i % 2 === 0 ? radius : radius * 0.46
    ctx.lineTo(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const createGiftTexture = (variant = 'front') => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f8f2df'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let x = 10; x < canvas.width; x += 16) {
    ctx.strokeStyle = 'rgba(188, 170, 134, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 8, canvas.height)
    ctx.stroke()
  }

  if (variant === 'front') {
    drawDotGrid(ctx)
    drawLidEdge(ctx)
    drawCherry(ctx, 92, 192, 0.78)
    drawPuppy(ctx, 280, 518, 1.32, 'float')
    drawPuppy(ctx, 790, 260, 0.98, 'scarf')
    drawPuppy(ctx, 735, 716, 1.18, 'headphone')
    drawStar(ctx, 102, 378, 82, 'rgba(219, 178, 76, 0.45)')
    drawStar(ctx, 462, 564, 92, 'rgba(219, 178, 76, 0.45)')
    drawStar(ctx, 350, 812, 62, 'rgba(219, 178, 76, 0.36)')
    drawCupcake(ctx, 556, 388, 0.82)
    drawCoffee(ctx, 458, 865, 0.72)
    drawApple(ctx, 880, 812, 0.64)
    drawPaw(ctx, 880, 560, 0.64)
    drawBow(ctx, 450, 214, 0.7)
    drawSprinkles(ctx, 22, 42)
  } else if (variant === 'top') {
    drawSprinkles(ctx, 72, 63)
    drawPuppy(ctx, 300, 368, 1.02, 'float')
    drawPuppy(ctx, 308, 650, 0.92, 'headphone')
    drawPuppy(ctx, 325, 850, 0.86, 'scarf')
    drawCherry(ctx, 544, 286, 0.72)
    drawCherry(ctx, 742, 408, 0.56)
    drawApple(ctx, 762, 570, 0.56)
    drawCoffee(ctx, 720, 748, 0.58)
    drawCupcake(ctx, 660, 350, 0.56)
    drawBow(ctx, 575, 190, 0.62)
    ctx.fillStyle = '#7baac0'
    ctx.font = '700 66px "Comic Sans MS", "Trebuchet MS", sans-serif'
    ctx.save()
    ctx.translate(630, 510)
    ctx.rotate(Math.PI / 2)
    ctx.fillText('Lucky puppy', -165, 0)
    ctx.restore()
    ctx.fillStyle = '#a49a84'
    ctx.beginPath()
    ctx.roundRect(120, 0, 116, 18, 6)
    ctx.roundRect(788, 0, 116, 18, 6)
    ctx.roundRect(120, 1006, 116, 18, 6)
    ctx.roundRect(788, 1006, 116, 18, 6)
    ctx.fill()
  } else {
    if (variant === 'left') {
      drawDotGrid(ctx)
      drawLidEdge(ctx)
      drawHandle(ctx, 510, 190, 0.92)
      drawPuppy(ctx, 510, 650, 1.34, 'headphone')
      drawCupcake(ctx, 160, 478, 0.72)
      drawCherry(ctx, 756, 388, 0.78)
      drawCoffee(ctx, 162, 824, 0.66)
      drawApple(ctx, 806, 820, 0.58)
      drawPaw(ctx, 192, 370, 0.72)
      drawStar(ctx, 158, 550, 86, 'rgba(219, 178, 76, 0.4)')
      drawStar(ctx, 828, 260, 62, 'rgba(219, 178, 76, 0.34)')
      ctx.fillStyle = '#7baac0'
      ctx.font = '700 74px "Comic Sans MS", "Trebuchet MS", sans-serif'
      ctx.fillText('Lucky puppy', 262, 330)
    } else if (variant === 'right') {
      drawDotGrid(ctx)
      drawLidEdge(ctx)
      drawHandle(ctx, 510, 180, 0.9)
      drawPuppy(ctx, 512, 662, 1.36, 'headphone')
      drawCupcake(ctx, 190, 480, 0.7)
      drawCherry(ctx, 770, 374, 0.72)
      drawCoffee(ctx, 190, 830, 0.64)
      drawApple(ctx, 806, 804, 0.58)
      drawBow(ctx, 740, 314, 0.68)
      drawStar(ctx, 160, 548, 78, 'rgba(219, 178, 76, 0.35)')
      ctx.fillStyle = '#7baac0'
      ctx.font = '700 74px "Comic Sans MS", "Trebuchet MS", sans-serif'
      ctx.fillText('Lucky puppy', 270, 332)
    } else {
      drawDotGrid(ctx)
      drawLidEdge(ctx)
      drawPuppy(ctx, 292, 498, 1.12, 'float')
      drawPuppy(ctx, 720, 630, 1.08, 'headphone')
      drawPuppy(ctx, 730, 292, 0.88, 'scarf')
      drawCherry(ctx, 744, 246, 0.72)
      drawCherry(ctx, 190, 780, 0.64)
      drawApple(ctx, 860, 806, 0.58)
      drawCoffee(ctx, 480, 804, 0.64)
      drawCupcake(ctx, 190, 310, 0.62)
      drawBow(ctx, 510, 244, 0.64)
      drawPaw(ctx, 860, 482, 0.58)
      drawStar(ctx, 190, 610, 66, 'rgba(219, 178, 76, 0.38)')
      drawStar(ctx, 560, 500, 78, 'rgba(219, 178, 76, 0.42)')
      drawStar(ctx, 818, 648, 42, 'rgba(219, 178, 76, 0.32)')
      ctx.fillStyle = '#7baac0'
      ctx.font = '700 54px "Comic Sans MS", "Trebuchet MS", sans-serif'
      ctx.fillText('Lucky puppy', 302, 352)
      drawSprinkles(ctx, 22, 99)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createGiftMaterials = () => {
  return [
    new THREE.MeshStandardMaterial({ map: createGiftTexture('right'), roughness: 0.84 }),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('left'), roughness: 0.84 }),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('top'), roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#f2dfbf', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('front'), roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('back'), roughness: 0.82 }),
  ]
}

const createLidMaterials = () => {
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: createLidSideTexture(),
    roughness: 0.84,
    emissive: '#f7efd8',
    emissiveIntensity: 0.18,
  })
  return [
    sideMaterial,
    sideMaterial.clone(),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('top'), roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#ead9b9', roughness: 0.9 }),
    sideMaterial.clone(),
    sideMaterial.clone(),
  ]
}

const createThinPanel = (width, height, material) => {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, 0.035, height, 4, 0.025), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const createLidAssembly = () => {
  const group = new THREE.Group()
  const topMaterial = new THREE.MeshStandardMaterial({ map: createGiftTexture('top'), roughness: 0.8 })
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: createLidSideTexture(),
    roughness: 0.86,
    emissive: '#f7efd8',
    emissiveIntensity: 0.24,
  })
  const creaseMaterial = new THREE.MeshStandardMaterial({ color: '#c7b48f', roughness: 0.9 })
  const notchMaterial = new THREE.MeshStandardMaterial({ color: '#8f8879', roughness: 0.92 })

  const topPanel = createThinPanel(3.1, 2.3, topMaterial)
  topPanel.position.y = 1.205
  group.add(topPanel)

  const frontFlap = new THREE.Mesh(new RoundedBoxGeometry(3.1, 0.24, 0.034, 4, 0.014), sideMaterial)
  frontFlap.position.set(0, 1.075, 1.162)
  frontFlap.castShadow = true
  frontFlap.receiveShadow = true
  group.add(frontFlap)

  const backFlap = frontFlap.clone()
  backFlap.position.z = -1.162
  group.add(backFlap)

  const leftFlap = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.24, 2.3, 4, 0.014), sideMaterial.clone())
  leftFlap.position.set(-1.562, 1.075, 0)
  leftFlap.castShadow = true
  leftFlap.receiveShadow = true
  group.add(leftFlap)

  const rightFlap = leftFlap.clone()
  rightFlap.position.x = 1.562
  group.add(rightFlap)

  const frontCrease = new THREE.Mesh(new RoundedBoxGeometry(3.02, 0.018, 0.02, 3, 0.005), creaseMaterial)
  frontCrease.position.set(0, 1.205, 1.18)
  group.add(frontCrease)
  const backCrease = frontCrease.clone()
  backCrease.position.z = -1.18
  group.add(backCrease)

  const leftCrease = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.018, 2.22, 3, 0.005), creaseMaterial)
  leftCrease.position.set(-1.58, 1.205, 0)
  group.add(leftCrease)
  const rightCrease = leftCrease.clone()
  rightCrease.position.x = 1.58
  group.add(rightCrease)

  ;[-0.88, 0.88].forEach((x) => {
    const notch = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.018, 0.046, 3, 0.008), notchMaterial)
    notch.position.set(x, 1.21, 1.174)
    group.add(notch)
  })

  return group
}

const createEnvelope = () => {
  const group = new THREE.Group()
  group.position.set(0, 1.62, 0.42)
  group.rotation.x = -0.72
  group.rotation.z = -0.035
  group.scale.setScalar(0.86)

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.78, 0.014, 0.96, 5, 0.035),
    new THREE.MeshStandardMaterial({
      map: createEnvelopeTexture(),
      roughness: 0.82,
      color: '#fff2d7',
    })
  )
  body.rotation.x = Math.PI / 2
  body.position.z = 0.02
  body.castShadow = true
  body.receiveShadow = true

  const rim = new THREE.Mesh(
    new RoundedBoxGeometry(1.86, 0.01, 1.02, 5, 0.04),
    new THREE.MeshStandardMaterial({
      color: '#d4a46e',
      roughness: 0.9,
      transparent: true,
      opacity: 0.38,
    })
  )
  rim.rotation.x = Math.PI / 2
  rim.position.z = 0.012

  const shadow = new THREE.Mesh(
    new RoundedBoxGeometry(1.86, 0.008, 1.0, 5, 0.04),
    new THREE.MeshBasicMaterial({
      color: '#8b6a48',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    })
  )
  shadow.rotation.x = Math.PI / 2
  shadow.position.set(0.035, -0.006, -0.026)

  group.add(shadow)
  group.add(rim)
  group.add(body)
  group.userData.floatOffset = Math.random() * Math.PI
  return group
}

const createScene = async () => {
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#f4f0e5', 8.5, 15)

  camera = new THREE.PerspectiveCamera(introCameraPath[0].fov, 1, 0.1, 30)
  applyIntroCamera(0)

  const ambient = new THREE.HemisphereLight('#fff8ef', '#d3e2dc', 1.42)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight('#fff2df', 1.92)
  keyLight.position.set(3.2, 4.8, 3.8)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  scene.add(keyLight)

  const fillLight = new THREE.PointLight('#b8d7df', 0.68, 8)
  fillLight.position.set(-2.8, 1.8, 2.6)
  scene.add(fillLight)

  boxGroup = new THREE.Group()
  boxGroup.position.set(0, 0.02, 0)
  boxGroup.scale.setScalar(0.74)
  scene.add(boxGroup)

  const box = new THREE.Mesh(
    new RoundedBoxGeometry(3.0, 2.0, 2.2, 6, 0.045),
    createGiftMaterials()
  )
  box.castShadow = true
  box.receiveShadow = true
  boxGroup.add(box)

  boxGroup.add(createLidAssembly())

  envelopeGroup = createEnvelope()
  boxGroup.add(envelopeGroup)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 80),
    new THREE.ShadowMaterial({ color: '#6d6659', opacity: 0.18 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1.68
  floor.receiveShadow = true
  scene.add(floor)

  updateSize()
  introStart = performance.now()
  animate()
}

const updateSize = () => {
  if (!renderer || !camera || !canvasRef.value) return

  const { clientWidth, clientHeight } = canvasRef.value
  renderer.setSize(clientWidth, clientHeight, false)
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
}

const animate = () => {
  animationFrame = window.requestAnimationFrame(animate)

  const elapsed = performance.now() * 0.001

  if (boxGroup) {
    if (stage.value === 'intro') {
      const progress = Math.min(1, (performance.now() - introStart) / introDuration)
      applyIntroCamera(progress)
    }

    camera.lookAt(cameraLookAt)

    if (!isDragging && !hasDragged.value && stage.value === 'ready') {
      targetRotation.y += 0.0028
    }

    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.09
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.09
    boxGroup.rotation.x = currentRotation.x
    boxGroup.rotation.y = currentRotation.y
  }

  if (envelopeGroup) {
    const isVisible = stage.value !== 'intro'
    envelopeGroup.visible = isVisible
    envelopeGroup.position.y = 1.58 + Math.sin(elapsed * 2.2) * 0.055
    envelopeGroup.rotation.z = -0.06 + Math.sin(elapsed * 1.7) * 0.025
  }

  updateEnvelopeHotspot()
  renderer?.render(scene, camera)
}

const onPointerDown = (event) => {
  if (isLetterOpen.value) return
  isDragging = true
  hasDragged.value = true
  previousPointer = { x: event.clientX, y: event.clientY }
  canvasRef.value?.setPointerCapture?.(event.pointerId)
}

const onPointerMove = (event) => {
  if (!isDragging || isLetterOpen.value) return

  const deltaX = event.clientX - previousPointer.x
  const deltaY = event.clientY - previousPointer.y
  previousPointer = { x: event.clientX, y: event.clientY }

  targetRotation.y += deltaX * 0.009
  targetRotation.x += deltaY * 0.006
  targetRotation.x = Math.max(-0.62, Math.min(0.38, targetRotation.x))
}

const onPointerUp = (event) => {
  isDragging = false
  canvasRef.value?.releasePointerCapture?.(event.pointerId)
}

onMounted(async () => {
  await createScene()

  introTimer = window.setTimeout(() => {
    stage.value = 'ready'
  }, introDuration)

  resizeObserver = new ResizeObserver(updateSize)
  resizeObserver.observe(canvasRef.value)
  window.addEventListener('resize', updateSize)
})

onBeforeUnmount(() => {
  window.clearTimeout(introTimer)
  window.clearInterval(typeTimer)
  window.cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', updateSize)
  resizeObserver?.disconnect()
  renderer?.dispose()
})
</script>

<template>
  <main class="start-scene" :class="[`is-${stage}`, { 'letter-open': isLetterOpen }]">
    <div class="ambient-layer" aria-hidden="true">
      <span v-for="item in 18" :key="item" class="sparkle" :style="{ '--i': item }"></span>
      <span class="ribbon ribbon-a"></span>
      <span class="ribbon ribbon-b"></span>
      <span class="ribbon ribbon-c"></span>
    </div>

    <section class="copy-layer" aria-label="开场文字">
      <p>For you</p>
      <h1>有一封信，放在今天的礼物上</h1>
    </section>

    <section class="three-stage" aria-label="3D 礼物箱">
      <canvas
        ref="canvasRef"
        class="gift-canvas"
        aria-label="可以拖动旋转查看的礼物箱"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      ></canvas>

      <button
        ref="envelopeHotspotRef"
        class="envelope-hotspot"
        type="button"
        :aria-disabled="!canOpenEnvelope"
        :disabled="!canOpenEnvelope"
        aria-label="打开箱子上的信封"
        @click="openEnvelope"
      ></button>

      <p class="drag-hint">{{ hasDragged ? '点一下箱子上的信封。' : '镜头靠近后，可以拖动箱子，也可以点信封。' }}</p>
    </section>

    <div class="letter-mask" aria-hidden="true"></div>

    <section class="letter-dialog" aria-label="信件内容">
      <div class="opened-envelope" aria-hidden="true">
        <span class="opened-back"></span>
        <span class="opened-flap"></span>
        <span class="opened-front"></span>
        <span class="opened-seal"></span>
      </div>

      <article class="letter-paper">
        <p class="letter-label">给最想见到的人</p>
        <p class="typewriter">{{ typedText }}<span v-if="stage === 'typing'" class="caret"></span></p>
      </article>
    </section>
  </main>
</template>
