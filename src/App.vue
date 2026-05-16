<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { letterText } from './data/letterContent'

const rootRef = ref(null)
const canvasRef = ref(null)
const envelopeHotspotRef = ref(null)
const lidHotspotRef = ref(null)
const stage = ref('intro')
const typedLength = ref(0)
const hasDragged = ref(false)
const envelopeDismissed = ref(false)

let renderer
let scene
let camera
let boxGroup
let lidGroup
let lidHotspotAnchor
let frontPanel
let envelopeGroup
let boxContentsGroup
let animationFrame = 0
let introTimer = 0
let extractionTimer = 0
let beginTypingTimer = 0
let letterFxTimer = 0
let typeTimer = 0
let lidTimeline
let resizeObserver
let ambientContext
let letterOpenTimeline
let letterFxContext
let signFxContext
let caretContext
let isDragging = false
let isPinching = false
let previousPointer = { x: 0, y: 0 }
let activePointers = new Map()
let pinchStartDistance = 0
let pinchStartZoom = 1
let targetRotation = { x: -0.22, y: -0.34 }
let currentRotation = { x: -0.22, y: -0.34 }
let targetZoom = 1
let currentZoom = 1
let introStart = 0
let extractionStart = 0
let cameraLookAt = new THREE.Vector3(0, 0.16, 0)
const introDuration = 3800
const extractionDuration = 860
const envelopeBaseY = 1.7
const envelopeBaseZ = 0.35
const envelopeBaseRotationX = -0.58
const envelopeBaseScale = 0.88
const envelopeFloatAmplitude = 0.026
const boxBaseScale = 0.74
const boxMinZoom = 0.78
const boxMaxZoom = 1.45
const storageBox = {
  width: 3.2,
  depth: 2.4,
  bodyHeight: 2.08,
  lidHeight: 0.18,
  lidOverhang: 0.13,
  lidTopThickness: 0.045,
  wallThickness: 0.04,
}
const storageBoxPalette = {
  paper: '#f2eee3',
  paperShadow: '#e7dfd0',
  paperSide: '#eee8db',
  paperLine: 'rgba(130, 121, 98, 0.18)',
  inner: '#d8d7d2',
  innerShadow: '#c2c0ba',
  textBlue: '#9aa6dd',
}

const lidViewCamera = {
  position: new THREE.Vector3(0, 3.55, 5.9),
  lookAt: new THREE.Vector3(0, 0.72, 0),
  fov: 42,
}

const openBoxCamera = {
  position: new THREE.Vector3(0, 7.35, 0.08),
  lookAt: new THREE.Vector3(0, -0.48, 0),
  fov: 38,
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)
const easeInOutSine = (value) => -(Math.cos(Math.PI * value) - 1) / 2

const introCameraStart = {
  position: new THREE.Vector3(0, 4.9, 8.8),
  lookAt: new THREE.Vector3(0, 0.04, 0),
  fov: 39,
}

const introCameraEnd = {
  position: new THREE.Vector3(0, 2.08, 6.36),
  lookAt: new THREE.Vector3(0, 0.36, 0.02),
  fov: 41,
}

const applyIntroCamera = (progress) => {
  const clamped = Math.max(0, Math.min(1, progress))
  const dollyProgress = easeInOutSine(clamped)
  const settleProgress = easeOutCubic(clamped)

  camera.position.lerpVectors(introCameraStart.position, introCameraEnd.position, dollyProgress)
  cameraLookAt.lerpVectors(introCameraStart.lookAt, introCameraEnd.lookAt, dollyProgress)
  camera.fov = introCameraStart.fov + (introCameraEnd.fov - introCameraStart.fov) * settleProgress
  camera.updateProjectionMatrix()
}

const setCameraPose = ({ position, lookAt, fov }) => {
  if (!camera) return

  camera.position.copy(position)
  cameraLookAt.copy(lookAt)
  camera.fov = fov
  camera.updateProjectionMatrix()
}

const focusLidView = () => {
  targetRotation = { x: -0.34, y: 0 }
  currentRotation = { x: -0.34, y: 0 }
  targetZoom = 0.86
  currentZoom = 0.86
  setCameraPose(lidViewCamera)
}

const typedText = computed(() => letterText.slice(0, typedLength.value))
const isExtractingEnvelope = computed(() => stage.value === 'extracting')
const isLetterOpen = computed(() => stage.value === 'opening' || stage.value === 'typing' || stage.value === 'done')
const isBoxOpening = computed(() => stage.value === 'box-opening')
const isBoxOpen = computed(() => stage.value === 'box-open')
const canOpenEnvelope = computed(() =>
  stage.value === 'ready' && !envelopeDismissed.value && !isExtractingEnvelope.value && !isLetterOpen.value
)
const canOpenLid = computed(() => stage.value === 'lid-ready')
const showLetterSign = computed(() => stage.value === 'done')
const hintText = computed(() => {
  if (canOpenLid.value) return '点一下箱子盖，看看里面。'
  if (isBoxOpening.value) return '箱子正在打开。'
  if (isBoxOpen.value) return ''
  return hasDragged.value ? '点一下箱子上的信封。' : '镜头靠近后，可以拖动箱子，也可以点信封。'
})

const killGsapContext = (context) => {
  context?.revert()
}

const setCanvasPointerCapture = (pointerId) => {
  try {
    canvasRef.value?.setPointerCapture?.(pointerId)
  } catch {
    // Some synthetic or interrupted pointer streams do not have an active pointer to capture.
  }
}

const releaseCanvasPointerCapture = (pointerId) => {
  try {
    canvasRef.value?.releasePointerCapture?.(pointerId)
  } catch {
    // Ignore already-released pointer streams.
  }
}

const startAmbientGsap = () => {
  killGsapContext(ambientContext)
  ambientContext = gsap.context(() => {
    gsap.utils.toArray('.ribbon').forEach((ribbon, index) => {
      gsap.to(ribbon, {
        y: -14 - index * 3,
        rotation: -14 + index * 5,
        duration: 4.8 + index * 0.7,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    })
  }, rootRef.value)
}

const stopLetterGsap = () => {
  window.clearTimeout(extractionTimer)
  extractionTimer = 0
  window.clearTimeout(letterFxTimer)
  letterFxTimer = 0
  letterOpenTimeline?.kill()
  letterOpenTimeline = null
  killGsapContext(letterFxContext)
  letterFxContext = null
  killGsapContext(signFxContext)
  signFxContext = null
  killGsapContext(caretContext)
  caretContext = null
}

const stopLidAnimation = () => {
  lidTimeline?.kill()
  lidTimeline = null
}

const resetLetterDisplay = () => {
  gsap.set('.letter-dialog', { clearProps: 'opacity,transform' })
  gsap.set('.letter-close', { clearProps: 'opacity,transform' })
  gsap.set('.letter-paper', { clearProps: 'opacity,transform' })
}

const animateLetterOpen = async () => {
  await nextTick()
  letterOpenTimeline?.kill()
  letterOpenTimeline = gsap.timeline()
  letterOpenTimeline
    .set('.letter-dialog', {
      opacity: 0,
      y: 18,
      scale: 0.94,
    })
    .set('.letter-paper', {
      opacity: 0,
      y: 34,
      scale: 0.96,
    })
    .set('.letter-close', {
      opacity: 0,
      scale: 0.9,
    })
    .to('.letter-dialog', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.72,
      ease: 'power3.out',
    }, 0)
    .to('.letter-paper', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.64,
      ease: 'power3.out',
    }, 0.1)
    .to('.letter-close', {
      opacity: 1,
      scale: 1,
      duration: 0.2,
      ease: 'power2.out',
    }, 0.34)
}

const startLetterPaperGsap = async () => {
  if (!isLetterOpen.value) return
  await nextTick()
  if (!isLetterOpen.value) return

  killGsapContext(letterFxContext)
  letterFxContext = gsap.context(() => {
    gsap.utils.toArray('.paper-fx-heart').forEach((heart, index) => {
      gsap.fromTo(heart,
        {
          opacity: 0,
          y: 24,
          x: 0,
          scale: 0.72,
          rotation: -12,
        },
        {
          opacity: 0,
          y: -690,
          x: index % 2 === 0 ? -18 : 16,
          scale: 1.1,
          rotation: index % 2 === 0 ? 22 : -18,
          duration: 7.2 + index * 0.55,
          delay: -index * 1.05,
          repeat: -1,
          ease: 'none',
          keyframes: [
            { opacity: 0, duration: 0 },
            { opacity: 0.62, duration: 0.12 },
            { opacity: 0.42, duration: 0.5 },
            { opacity: 0, duration: 0.38 },
          ],
        }
      )
    })

    gsap.to('.paper-sparkles-heart', {
      y: -3,
      scale: 1.08,
      opacity: 0.42,
      rotation: -8,
      duration: 1.05,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })

    gsap.to('.paper-sparkles-glow', {
      scaleX: 1.18,
      opacity: 0.8,
      duration: 1.05,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })

    gsap.utils.toArray('.paper-sparkle').forEach((sparkle, index) => {
      gsap.fromTo(sparkle,
        {
          opacity: 0,
          x: 0,
          y: 12,
          scale: 0.7,
        },
        {
          opacity: 0,
          x: -12 - index * 3,
          y: -42 - index * 8,
          scale: 1.12,
          duration: 2.8,
          delay: index * 0.7,
          repeat: -1,
          ease: 'power1.out',
          keyframes: [
            { opacity: 0, duration: 0 },
            { opacity: 0.7, duration: 0.18 },
            { opacity: 0, duration: 0.82 },
          ],
        }
      )
    })

  }, rootRef.value)
}

const startSignGsap = async () => {
  await nextTick()
  killGsapContext(signFxContext)
  signFxContext = gsap.context(() => {
    gsap.to('.sign-heart', {
      scale: 1.2,
      duration: 0.22,
      repeat: -1,
      yoyo: true,
      repeatDelay: 0.5,
      ease: 'sine.inOut',
      transformOrigin: 'center',
    })

    gsap.fromTo('.sign-heart-float',
      {
        opacity: 0,
        x: 0,
        y: 0,
        scale: 0.72,
      },
      {
        opacity: 0,
        x: -18,
        y: -34,
        scale: 1.08,
        duration: 2.2,
        repeat: -1,
        ease: 'power1.out',
        keyframes: [
          { opacity: 0, duration: 0 },
          { opacity: 0.68, duration: 0.18 },
          { opacity: 0, duration: 0.82 },
        ],
      }
    )
  }, rootRef.value)
}

const startCaretGsap = async () => {
  await nextTick()
  killGsapContext(caretContext)
  caretContext = gsap.context(() => {
    gsap.to('.caret', {
      opacity: 0,
      duration: 0.38,
      repeat: -1,
      yoyo: true,
      ease: 'steps(1)',
    })
  }, rootRef.value)
}

watch(showLetterSign, (visible) => {
  if (visible) {
    startSignGsap()
  } else {
    killGsapContext(signFxContext)
    signFxContext = null
  }
})

watch(stage, (nextStage) => {
  if (nextStage === 'typing') {
    startCaretGsap()
    return
  }

  killGsapContext(caretContext)
  caretContext = null
})

const updateEnvelopeHotspot = () => {
  if (!envelopeGroup || !camera || !canvasRef.value || !envelopeHotspotRef.value) return

  const vector = new THREE.Vector3()
  envelopeGroup.getWorldPosition(vector)
  vector.project(camera)

  const rect = canvasRef.value.getBoundingClientRect()
  const x = rect.left + ((vector.x + 1) / 2) * rect.width
  const y = rect.top + ((-vector.y + 1) / 2) * rect.height
  const isVisible = canOpenEnvelope.value && envelopeGroup.visible && vector.z < 1
  const hotspot = envelopeHotspotRef.value

  hotspot.style.left = `${x}px`
  hotspot.style.top = `${y}px`
  hotspot.style.opacity = isVisible ? '1' : '0'
  hotspot.style.pointerEvents = isVisible ? 'auto' : 'none'
}

const updateLidHotspot = () => {
  if (!lidHotspotAnchor || !camera || !canvasRef.value || !lidHotspotRef.value) return

  const vector = new THREE.Vector3()
  lidHotspotAnchor.getWorldPosition(vector)
  vector.project(camera)

  const rect = canvasRef.value.getBoundingClientRect()
  const x = rect.left + ((vector.x + 1) / 2) * rect.width
  const y = rect.top + ((-vector.y + 1) / 2) * rect.height
  const isVisible = canOpenLid.value && vector.z < 1
  const hotspot = lidHotspotRef.value

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
    typedLength.value += 2

    if (typedLength.value >= letterText.length) {
      typedLength.value = letterText.length
      window.clearInterval(typeTimer)
      stage.value = 'done'
    }
  }, 22)
}

const openEnvelope = () => {
  if (!canOpenEnvelope.value) return

  window.clearTimeout(introTimer)
  window.clearTimeout(extractionTimer)
  window.clearTimeout(beginTypingTimer)
  window.clearTimeout(letterFxTimer)
  window.clearInterval(typeTimer)
  typedLength.value = 0
  stage.value = 'opening'
  animateLetterOpen()
  beginTypingTimer = window.setTimeout(beginTyping, 920)
  letterFxTimer = window.setTimeout(startLetterPaperGsap, 1320)
}

const closeLetter = () => {
  stopLetterGsap()
  window.clearTimeout(beginTypingTimer)
  window.clearInterval(typeTimer)
  typedLength.value = 0
  envelopeDismissed.value = true
  if (envelopeGroup) {
    envelopeGroup.visible = false
  }
  focusLidView()
  stage.value = 'lid-ready'
  resetLetterDisplay()
}

const openLid = () => {
  if (!canOpenLid.value || !lidGroup || !camera) return

  stopLidAnimation()
  lidGroup.visible = true
  lidGroup.scale.setScalar(1)
  lidGroup.position.set(0, 0, 0)
  lidGroup.rotation.set(0, 0, 0)
  stage.value = 'box-opening'
  hasDragged.value = true
  targetRotation = { x: 0, y: 0 }
  targetZoom = 1.02

  const cameraTarget = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    fov: camera.fov,
    lookX: cameraLookAt.x,
    lookY: cameraLookAt.y,
    lookZ: cameraLookAt.z,
  }

  lidTimeline = gsap.timeline({
    defaults: { ease: 'power3.inOut' },
    onUpdate: () => {
      camera.position.set(cameraTarget.x, cameraTarget.y, cameraTarget.z)
      cameraLookAt.set(cameraTarget.lookX, cameraTarget.lookY, cameraTarget.lookZ)
      camera.fov = cameraTarget.fov
      camera.updateProjectionMatrix()
    },
    onComplete: () => {
      stage.value = 'box-open'
      lidTimeline = null
    },
  })

  lidTimeline
    .to(lidGroup.position, {
      y: 0.2,
      z: -1.08,
      duration: 0.24,
      ease: 'power2.out',
    }, 0)
    .to(lidGroup.rotation, {
      x: -1.38,
      y: 0,
      z: 0,
      duration: 0.82,
    }, 0.12)
    .to(lidGroup.position, {
      y: 0.74,
      z: -1.64,
      duration: 0.82,
    }, 0.12)
    .to(lidGroup.scale, {
      x: 0.98,
      y: 0.98,
      z: 0.98,
      duration: 0.82,
    }, 0.12)
    .to(cameraTarget, {
      x: openBoxCamera.position.x,
      y: openBoxCamera.position.y,
      z: openBoxCamera.position.z,
      lookX: openBoxCamera.lookAt.x,
      lookY: openBoxCamera.lookAt.y,
      lookZ: openBoxCamera.lookAt.z,
      fov: openBoxCamera.fov,
      duration: 1.25,
    }, 0.18)
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

  ctx.fillStyle = storageBoxPalette.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let x = 0; x < canvas.width; x += 34) {
    ctx.strokeStyle = 'rgba(164, 151, 126, 0.035)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 6, canvas.height)
    ctx.stroke()
  }

  drawConfettiPattern(ctx, 30, 73)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createEnvelopeTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 700
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f8f2e4'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(170, 155, 120, 0.12)'
  for (let y = 34; y < canvas.height; y += 36) {
    for (let x = 28; x < canvas.width; x += 36) {
      ctx.beginPath()
      ctx.arc(x, y, 1.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawConfettiPattern(ctx, 78, 219)

  ctx.save()
  ctx.shadowColor = 'rgba(106, 93, 73, 0.18)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 10
  ctx.fillStyle = '#fbf6e9'
  ctx.beginPath()
  ctx.moveTo(0, 18)
  ctx.quadraticCurveTo(44, 184, 184, 224)
  ctx.lineTo(700, 458)
  ctx.lineTo(1216, 224)
  ctx.quadraticCurveTo(1356, 184, 1400, 18)
  ctx.lineTo(1400, 0)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(126, 118, 98, 0.2)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 18)
  ctx.quadraticCurveTo(44, 184, 184, 224)
  ctx.lineTo(700, 458)
  ctx.lineTo(1216, 224)
  ctx.quadraticCurveTo(1356, 184, 1400, 18)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(126, 118, 98, 0.13)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 692)
  ctx.lineTo(542, 420)
  ctx.moveTo(1400, 692)
  ctx.lineTo(858, 420)
  ctx.stroke()

  ctx.globalAlpha = 0.92
  drawPuppy(ctx, 310, 520, 0.9, 'headphone')
  drawCherry(ctx, 706, 182, 0.8)
  drawCupcake(ctx, 1110, 376, 0.58)
  drawApple(ctx, 1256, 388, 0.58)
  drawPaw(ctx, 1210, 536, 0.6)
  drawBow(ctx, 972, 520, 0.56)
  ctx.globalAlpha = 1

  ctx.fillStyle = '#9aa6dd'
  ctx.font = '700 74px "Comic Sans MS", "Trebuchet MS", sans-serif'
  ctx.save()
  ctx.translate(705, 540)
  ctx.rotate(0.02)
  ctx.fillText('Lucky pppy', -185, 0)
  ctx.restore()

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

const drawConfettiPattern = (ctx, count, seed = 1) => {
  const colors = ['#df8f9b', '#8db8d5', '#e0c867', '#9dc79d', '#d4ad72', '#b3afe2']
  let value = seed

  for (let i = 0; i < count; i += 1) {
    value = (value * 9301 + 49297) % 233280
    const x = (value / 233280) * ctx.canvas.width
    value = (value * 9301 + 49297) % 233280
    const y = (value / 233280) * ctx.canvas.height
    const color = colors[i % colors.length]

    ctx.fillStyle = color
    ctx.globalAlpha = 0.54
    ctx.beginPath()
    ctx.arc(x, y, 3.2 + (i % 3) * 0.7, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

const drawDottedPaper = (ctx) => {
  ctx.fillStyle = storageBoxPalette.paper
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  ctx.fillStyle = 'rgba(174, 159, 126, 0.11)'
  for (let y = 34; y < ctx.canvas.height; y += 34) {
    for (let x = 30; x < ctx.canvas.width; x += 34) {
      ctx.beginPath()
      ctx.arc(x, y, 1.45, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const drawPanelBorder = (ctx) => {
  ctx.strokeStyle = 'rgba(137, 129, 108, 0.14)'
  ctx.lineWidth = 3
  ctx.strokeRect(10, 10, ctx.canvas.width - 20, ctx.canvas.height - 20)
}

const drawStorageBoxTexture = (variant = 'front') => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')

  drawDottedPaper(ctx)
  drawConfettiPattern(ctx, variant === 'top' ? 130 : 96, variant.length * 31)

  if (variant === 'front') {
    ctx.globalAlpha = 0.82
    drawPuppy(ctx, 255, 520, 1.25, 'float')
    drawPuppy(ctx, 560, 610, 1.08, 'headphone')
    drawPuppy(ctx, 760, 330, 0.92, 'scarf')
    ctx.globalAlpha = 0.78
    drawCherry(ctx, 142, 260, 0.72)
    drawApple(ctx, 884, 780, 0.62)
    drawCupcake(ctx, 660, 750, 0.7)
    drawCoffee(ctx, 440, 830, 0.62)
    drawPaw(ctx, 878, 534, 0.58)
    drawBow(ctx, 572, 240, 0.62)
    drawStar(ctx, 205, 708, 76, 'rgba(224, 194, 85, 0.32)')
    drawStar(ctx, 588, 462, 54, 'rgba(224, 194, 85, 0.2)')
    ctx.globalAlpha = 1
  } else if (variant === 'top') {
    ctx.globalAlpha = 0.78
    drawPuppy(ctx, 276, 600, 0.92, 'float')
    drawPuppy(ctx, 520, 432, 0.78, 'headphone')
    drawPuppy(ctx, 680, 620, 0.76, 'scarf')
    drawCherry(ctx, 344, 270, 0.62)
    drawApple(ctx, 770, 440, 0.52)
    drawCupcake(ctx, 740, 728, 0.52)
    drawPaw(ctx, 246, 376, 0.54)
    drawBow(ctx, 606, 248, 0.52)
    ctx.globalAlpha = 1
    ctx.fillStyle = storageBoxPalette.textBlue
    ctx.font = '700 62px "Comic Sans MS", "Trebuchet MS", sans-serif'
    ctx.save()
    ctx.translate(512, 520)
    ctx.rotate(-0.08)
    ctx.fillText('Lucky puppy', -180, 0)
    ctx.restore()
    drawPanelBorder(ctx)
  } else if (variant === 'left' || variant === 'right') {
    ctx.globalAlpha = 0.78
    drawPuppy(ctx, variant === 'left' ? 400 : 600, 470, 1.0, 'scarf')
    drawPaw(ctx, variant === 'left' ? 760 : 244, 690, 0.62)
    drawCherry(ctx, variant === 'left' ? 250 : 784, 780, 0.52)
    drawStar(ctx, variant === 'left' ? 696 : 300, 350, 52, 'rgba(224, 194, 85, 0.2)')
    ctx.globalAlpha = 1
  } else {
    ctx.globalAlpha = 0.76
    drawPuppy(ctx, 330, 520, 0.92, 'float')
    drawPuppy(ctx, 710, 430, 0.86, 'headphone')
    drawCherry(ctx, 206, 328, 0.56)
    drawStar(ctx, 532, 690, 54, 'rgba(224, 194, 85, 0.18)')
    ctx.globalAlpha = 1
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createGiftTexture = drawStorageBoxTexture

const createWrappedGiftTexture = (seed = 1) => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  let value = seed * 997

  ctx.fillStyle = '#f7efd9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(255,255,255,0.36)'
  ctx.fillRect(0, 0, canvas.width, 46)

  ctx.strokeStyle = 'rgba(156, 132, 92, 0.08)'
  ctx.lineWidth = 1
  for (let x = -80; x < canvas.width; x += 34) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 150, canvas.height)
    ctx.stroke()
  }

  for (let i = 0; i < 92; i += 1) {
    value = (value * 9301 + 49297) % 233280
    const x = (value / 233280) * canvas.width
    value = (value * 9301 + 49297) % 233280
    const y = (value / 233280) * canvas.height
    value = (value * 9301 + 49297) % 233280
    const radius = 1.4 + (value % 5) * 0.55

    ctx.fillStyle = value % 3 === 0 ? 'rgba(126, 89, 47, 0.6)' : 'rgba(174, 112, 55, 0.48)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 0.72
  drawPuppy(ctx, 120 + (seed % 3) * 62, 118 + (seed % 2) * 72, 0.34, seed % 2 ? 'scarf' : 'float')
  drawStar(ctx, 362, 118 + (seed % 3) * 34, 23, '#e6cc78')
  drawStar(ctx, 78 + (seed % 4) * 28, 354, 18, '#b7d8dd')
  drawCherry(ctx, 390, 356, 0.22)
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createGiftTagTexture = (seed = 1) => {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f8eed8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = 'rgba(149, 121, 82, 0.26)'
  ctx.lineWidth = 5
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18)
  ctx.fillStyle = 'rgba(156, 121, 80, 0.42)'
  ctx.beginPath()
  ctx.arc(canvas.width / 2, 32, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9b7a56'
  ctx.font = '600 18px "Comic Sans MS", "Trebuchet MS", sans-serif'
  ctx.save()
  ctx.translate(64, 74)
  ctx.rotate(-0.08)
  ctx.fillText(seed % 2 ? 'Happy' : 'Lucky', 0, 0)
  ctx.fillText('day', 20, 28)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createGiftMaterials = () => {
  const makeOuterMaterial = (variant, options = {}) => new THREE.MeshStandardMaterial({
    map: createGiftTexture(variant),
    roughness: 0.92,
    color: options.color || '#ffffff',
    emissive: options.emissive || '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 0,
  })

  const materials = [
    makeOuterMaterial('right', { color: '#ffffff' }),
    makeOuterMaterial('left', { color: '#ffffff' }),
    new THREE.MeshStandardMaterial({ map: createGiftTexture('top'), roughness: 0.9, color: '#ffffff' }),
    new THREE.MeshStandardMaterial({ color: storageBoxPalette.paperShadow, roughness: 0.92 }),
    makeOuterMaterial('front', { color: '#ffffff' }),
    makeOuterMaterial('back', { color: '#ffffff' }),
  ]
  materials.forEach((material) => {
    material.polygonOffset = true
    material.polygonOffsetFactor = -1
    material.polygonOffsetUnits = -1
  })
  return materials
}

const createOpenTopBoxMaterials = () => {
  const materials = createGiftMaterials()
  materials[2] = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  })
  return materials
}

const createHiddenMaterial = () => new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
})

const createSoftEdgeMaterial = (color = '#e9dabd', opacity = 0.5) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.94,
  transparent: true,
  opacity,
  depthWrite: false,
})

const createLidMaterials = () => {
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: createLidSideTexture(),
    roughness: 0.84,
    emissive: storageBoxPalette.paper,
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

const createLidAssembly = () => {
  const group = new THREE.Group()
  const {
    width,
    depth,
    bodyHeight,
    lidHeight,
    lidOverhang,
    lidTopThickness,
    wallThickness,
  } = storageBox
  const lidWidth = width + lidOverhang * 2
  const lidDepth = depth + lidOverhang * 2
  const topY = bodyHeight / 2 + lidTopThickness / 2 + 0.012
  const skirtY = topY - lidTopThickness / 2 - lidHeight / 2

  group.position.set(0, 0, 0)
  const topMaterial = new THREE.MeshStandardMaterial({
    map: createGiftTexture('top'),
    roughness: 0.9,
    color: '#ffffff',
  })
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: createLidSideTexture(),
    roughness: 0.9,
    color: '#f8f5ee',
  })
  const topPanel = new THREE.Mesh(
    new THREE.BoxGeometry(lidWidth, lidTopThickness, lidDepth),
    topMaterial
  )
  topPanel.position.set(0, topY, 0)
  topPanel.castShadow = true
  topPanel.receiveShadow = true
  group.add(topPanel)

  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(lidWidth, lidHeight, wallThickness), sideMaterial)
  frontFlap.position.set(0, skirtY, lidDepth / 2 - wallThickness / 2)
  frontFlap.castShadow = false
  frontFlap.receiveShadow = true
  group.add(frontFlap)

  const backFlap = frontFlap.clone()
  backFlap.position.z = -lidDepth / 2 + wallThickness / 2
  group.add(backFlap)

  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, lidHeight, lidDepth), sideMaterial.clone())
  leftFlap.position.set(-lidWidth / 2 + wallThickness / 2, skirtY, 0)
  leftFlap.castShadow = false
  leftFlap.receiveShadow = true
  group.add(leftFlap)

  const rightFlap = leftFlap.clone()
  rightFlap.position.x = lidWidth / 2 - wallThickness / 2
  group.add(rightFlap)

  lidHotspotAnchor = new THREE.Object3D()
  lidHotspotAnchor.position.set(0, topY + 0.08, 0)
  group.add(lidHotspotAnchor)

  return group
}

const createOpenBoxShell = () => {
  const group = new THREE.Group()
  const { width, depth, bodyHeight, wallThickness } = storageBox
  const innerInset = 0.012
  const rimHeight = wallThickness * 1.2
  const rimWidth = wallThickness * 1.75
  const materials = createOpenTopBoxMaterials()
  materials[0] = createHiddenMaterial()
  materials[1] = createHiddenMaterial()
  const innerMaterial = new THREE.MeshStandardMaterial({
    color: storageBoxPalette.inner,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })

  const addPanel = (geometry, material, position, rotation = {}) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(position.x, position.y, position.z)
    mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const createRoundedRectPath = (shapeWidth, shapeHeight, radius, offsetX = 0, offsetY = 0) => {
    const x = -shapeWidth / 2 + offsetX
    const y = -shapeHeight / 2 + offsetY
    const path = new THREE.Path()
    path.moveTo(x + radius, y)
    path.lineTo(x + shapeWidth - radius, y)
    path.quadraticCurveTo(x + shapeWidth, y, x + shapeWidth, y + radius)
    path.lineTo(x + shapeWidth, y + shapeHeight - radius)
    path.quadraticCurveTo(x + shapeWidth, y + shapeHeight, x + shapeWidth - radius, y + shapeHeight)
    path.lineTo(x + radius, y + shapeHeight)
    path.quadraticCurveTo(x, y + shapeHeight, x, y + shapeHeight - radius)
    path.lineTo(x, y + radius)
    path.quadraticCurveTo(x, y, x + radius, y)
    return path
  }

  const createRoundedRectShape = (shapeWidth, shapeHeight, radius) => {
    const shape = new THREE.Shape()
    shape.curves = createRoundedRectPath(shapeWidth, shapeHeight, radius).curves
    shape.currentPoint.copy(createRoundedRectPath(shapeWidth, shapeHeight, radius).currentPoint)
    return shape
  }

  const createSideShapeWithHandle = (panelWidth, panelHeight, handleCenterY) => {
    const shape = new THREE.Shape()
    shape.moveTo(-panelWidth / 2, -panelHeight / 2)
    shape.lineTo(panelWidth / 2, -panelHeight / 2)
    shape.lineTo(panelWidth / 2, panelHeight / 2)
    shape.lineTo(-panelWidth / 2, panelHeight / 2)
    shape.lineTo(-panelWidth / 2, -panelHeight / 2)

    const hole = createRoundedRectPath(0.72, 0.34, 0.16, 0, handleCenterY)
    shape.holes.push(hole)
    return shape
  }

  const normalizeShapeGeometryUvs = (geometry, planeWidth, planeHeight) => {
    const positions = geometry.attributes.position
    const uvs = geometry.attributes.uv
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      uvs.setXY(i, (x + planeWidth / 2) / planeWidth, 1 - (y + planeHeight / 2) / planeHeight)
    }
    uvs.needsUpdate = true
  }

  const createHandleRingGeometry = () => {
    const ringShape = createRoundedRectShape(0.86, 0.46, 0.21)
    ringShape.holes.push(createRoundedRectPath(0.7, 0.32, 0.15))
    return new THREE.ShapeGeometry(ringShape, 24)
  }

  const createSidePanel = (side = 'left') => {
    const sign = side === 'left' ? -1 : 1
    const material = new THREE.MeshStandardMaterial({
      map: createGiftTexture(side),
      roughness: 0.92,
      color: '#ffffff',
      side: THREE.DoubleSide,
    })
    const geometry = new THREE.ShapeGeometry(createSideShapeWithHandle(depth, bodyHeight, bodyHeight * 0.23), 48)
    normalizeShapeGeometryUvs(geometry, depth, bodyHeight)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(sign * width / 2, 0, 0)
    mesh.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const createInnerSidePanel = (side = 'left') => {
    const sign = side === 'left' ? -1 : 1
    const panelHeight = bodyHeight - rimHeight
    const geometry = new THREE.ShapeGeometry(
      createSideShapeWithHandle(depth - innerInset * 2, panelHeight, bodyHeight * 0.23 + rimHeight / 2),
      48
    )
    const mesh = new THREE.Mesh(geometry, innerMaterial)
    mesh.position.set(sign * (width / 2 - innerInset), -rimHeight / 2, 0)
    mesh.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2
    mesh.receiveShadow = true
    return mesh
  }

  const createHandleTunnel = (side = 'left') => {
    const sign = side === 'left' ? -1 : 1
    const handleGroup = new THREE.Group()
    const handleCenterY = bodyHeight * 0.23
    const lipMaterial = new THREE.MeshBasicMaterial({
      color: '#e3dccf',
      side: THREE.DoubleSide,
    })
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#bdb7aa',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const outerLip = new THREE.Mesh(
      createHandleRingGeometry(),
      lipMaterial
    )
    const innerShadow = new THREE.Mesh(
      createHandleRingGeometry(),
      shadowMaterial
    )

    outerLip.position.z = -0.006
    innerShadow.position.z = -0.011
    outerLip.renderOrder = 4
    innerShadow.renderOrder = 5
    handleGroup.add(outerLip)
    handleGroup.add(innerShadow)
    handleGroup.position.set(sign * (width / 2 + 0.003), handleCenterY, 0)
    handleGroup.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2
    return handleGroup
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight, depth), materials)
  body.position.y = 0
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)
  frontPanel = body
  group.add(createSidePanel('left'))
  group.add(createSidePanel('right'))

  const innerBack = addPanel(
    new THREE.PlaneGeometry(width - innerInset * 2, bodyHeight - rimHeight),
    innerMaterial,
    { x: 0, y: -rimHeight / 2, z: -depth / 2 + innerInset },
    { y: Math.PI }
  )
  innerBack.receiveShadow = true

  const innerFront = addPanel(
    new THREE.PlaneGeometry(width - innerInset * 2, bodyHeight - rimHeight),
    innerMaterial,
    { x: 0, y: -rimHeight / 2, z: depth / 2 - innerInset }
  )
  innerFront.receiveShadow = true

  const innerLeft = createInnerSidePanel('left')
  group.add(innerLeft)
  innerLeft.receiveShadow = true

  const innerRight = createInnerSidePanel('right')
  group.add(innerRight)
  innerRight.receiveShadow = true

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: storageBoxPalette.paperShadow,
    roughness: 0.88,
  })
  addPanel(
    new THREE.BoxGeometry(width, rimHeight, rimWidth),
    rimMaterial,
    { x: 0, y: bodyHeight / 2 - rimHeight / 2 + 0.006, z: depth / 2 - rimWidth / 2 }
  )
  addPanel(
    new THREE.BoxGeometry(width, rimHeight, rimWidth),
    rimMaterial,
    { x: 0, y: bodyHeight / 2 - rimHeight / 2 + 0.006, z: -depth / 2 + rimWidth / 2 }
  )
  addPanel(
    new THREE.BoxGeometry(rimWidth, rimHeight, depth),
    rimMaterial,
    { x: -width / 2 + rimWidth / 2, y: bodyHeight / 2 - rimHeight / 2 + 0.006, z: 0 }
  )
  addPanel(
    new THREE.BoxGeometry(rimWidth, rimHeight, depth),
    rimMaterial,
    { x: width / 2 - rimWidth / 2, y: bodyHeight / 2 - rimHeight / 2 + 0.006, z: 0 }
  )

  const innerFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(width - innerInset * 2, depth - innerInset * 2),
    new THREE.MeshStandardMaterial({
      color: storageBoxPalette.innerShadow,
      roughness: 0.86,
      side: THREE.DoubleSide,
    })
  )
  innerFloor.rotation.x = -Math.PI / 2
  innerFloor.position.y = -bodyHeight / 2 + wallThickness + 0.006
  innerFloor.receiveShadow = true
  group.add(innerFloor)

  group.add(createHandleTunnel('left'))
  group.add(createHandleTunnel('right'))

  return group
}

const createWrappedGift = ({
  x,
  y,
  z,
  width,
  height,
  depth,
  seed = 1,
  rotation = 0,
}) => {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.rotation.y = rotation
  group.rotation.z = (seed % 2 === 0 ? 1 : -1) * 0.035

  const paperMaterial = new THREE.MeshStandardMaterial({
    map: createWrappedGiftTexture(seed),
    color: '#fffaf0',
    roughness: 0.9,
    emissive: '#f7efd8',
    emissiveIntensity: 0.025,
  })
  const ribbonMaterial = new THREE.MeshStandardMaterial({
    color: '#f4ead2',
    roughness: 0.68,
    metalness: 0.03,
    transparent: true,
    opacity: 0.94,
  })
  const ribbonEdgeMaterial = new THREE.MeshStandardMaterial({
    color: '#d8c49d',
    roughness: 0.78,
    transparent: true,
    opacity: 0.42,
  })

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(width, depth) * 0.44, 28),
    new THREE.MeshBasicMaterial({
      color: '#57534c',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  )
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.y = -height / 2 - 0.006
  contactShadow.scale.set(1.24, 0.74, 1)
  contactShadow.renderOrder = 1
  group.add(contactShadow)

  const box = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 4, 0.035),
    paperMaterial
  )
  box.castShadow = true
  box.receiveShadow = true
  group.add(box)

  const ribbonWidth = Math.min(width, depth) * 0.16
  const ribbonDepth = 0.012
  const verticalRibbon = new THREE.Mesh(
    new RoundedBoxGeometry(width + 0.02, height + 0.026, ribbonWidth, 3, 0.014),
    ribbonMaterial
  )
  verticalRibbon.castShadow = true
  verticalRibbon.receiveShadow = true
  group.add(verticalRibbon)

  const horizontalRibbon = new THREE.Mesh(
    new RoundedBoxGeometry(ribbonWidth, height + 0.028, depth + 0.02, 3, 0.014),
    ribbonMaterial
  )
  horizontalRibbon.castShadow = true
  horizontalRibbon.receiveShadow = true
  group.add(horizontalRibbon)

  const topRibbonA = new THREE.Mesh(
    new RoundedBoxGeometry(width + 0.028, ribbonDepth, ribbonWidth * 0.72, 2, 0.008),
    ribbonEdgeMaterial
  )
  topRibbonA.position.y = height / 2 + 0.015
  topRibbonA.rotation.y = 0.02
  group.add(topRibbonA)

  const topRibbonB = new THREE.Mesh(
    new RoundedBoxGeometry(ribbonWidth * 0.72, ribbonDepth, depth + 0.028, 2, 0.008),
    ribbonEdgeMaterial
  )
  topRibbonB.position.y = height / 2 + 0.018
  topRibbonB.rotation.y = -0.02
  group.add(topRibbonB)

  const bowGroup = new THREE.Group()
  bowGroup.position.set(0, height / 2 + 0.046, 0)
  bowGroup.rotation.y = (seed % 3 - 1) * 0.22

  const loopWidth = Math.min(width, depth) * 0.2
  const loopDepth = Math.min(width, depth) * 0.112
  ;[-1, 1].forEach((side) => {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(loopWidth, 0.012, 8, 24),
      ribbonMaterial
    )
    loop.position.x = side * loopWidth * 0.54
    loop.rotation.x = Math.PI / 2
    loop.rotation.z = side * 0.38
    loop.scale.set(0.92, 0.54, 1)
    loop.castShadow = true
    bowGroup.add(loop)
  })

  const knot = new THREE.Mesh(
    new RoundedBoxGeometry(loopDepth, 0.036, loopDepth, 3, 0.012),
    ribbonMaterial
  )
  knot.castShadow = true
  bowGroup.add(knot)

  const tailA = new THREE.Mesh(
    new RoundedBoxGeometry(ribbonWidth * 0.5, 0.018, Math.min(depth * 0.34, 0.17), 2, 0.007),
    ribbonMaterial
  )
  tailA.position.set(-loopWidth * 0.16, -0.018, loopDepth * 0.98)
  tailA.rotation.y = -0.28
  bowGroup.add(tailA)

  const tailB = tailA.clone()
  tailB.position.x = loopWidth * 0.24
  tailB.position.z = -loopDepth * 0.9
  tailB.rotation.y = 0.34
  bowGroup.add(tailB)
  group.add(bowGroup)

  const tag = new THREE.Mesh(
    new RoundedBoxGeometry(width * 0.22, 0.01, depth * 0.34, 2, 0.008),
    new THREE.MeshStandardMaterial({
      map: createGiftTagTexture(seed),
      color: '#fff8e8',
      roughness: 0.88,
    })
  )
  tag.position.set(width * 0.22, height / 2 + 0.026, depth * 0.22)
  tag.rotation.y = -0.22
  tag.castShadow = true
  group.add(tag)

  return group
}

const createBoxContents = () => {
  const group = new THREE.Group()
  const floorY = -storageBox.bodyHeight / 2 + storageBox.wallThickness + 0.006
  const giftRestY = (height, sink = 0.018) => floorY + height / 2 - sink
  const createInnerEnvelope = () => {
    const envelope = new THREE.Group()
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.14, 0.56),
      new THREE.MeshBasicMaterial({
        color: '#5a554d',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = floorY + 0.009
    shadow.position.set(0.02, floorY + 0.009, 0.012)

    const body = new THREE.Mesh(
      new RoundedBoxGeometry(1.16, 0.018, 0.58, 4, 0.012),
      new THREE.MeshStandardMaterial({
        map: createEnvelopeTexture(),
        roughness: 0.88,
        color: '#ffffff',
      })
    )
    body.position.y = floorY + 0.03
    body.castShadow = true
    body.receiveShadow = true

    envelope.add(shadow)
    envelope.add(body)
    envelope.position.set(0.06, 0, 0.07)
    envelope.rotation.y = -0.12
    envelope.rotation.z = 0.02
    return envelope
  }

  const gifts = [
    { x: -0.78, z: -0.48, width: 0.58, height: 0.52, depth: 0.56, rotation: 0.42, sink: 0.024, seed: 1 },
    { x: -0.06, z: -0.5, width: 0.72, height: 0.46, depth: 0.5, rotation: -0.06, sink: 0.02, seed: 2 },
    { x: 0.68, z: -0.34, width: 0.48, height: 0.48, depth: 0.48, rotation: 0.58, sink: 0.022, seed: 3 },
    { x: -0.46, z: 0.22, width: 0.5, height: 0.38, depth: 0.42, rotation: -0.7, sink: 0.018, seed: 4 },
    { x: 0.36, z: 0.26, width: 0.52, height: 0.36, depth: 0.46, rotation: 0.3, sink: 0.018, seed: 5 },
  ]

  gifts.forEach((gift) => {
    group.add(createWrappedGift({
      ...gift,
      y: giftRestY(gift.height, gift.sink),
    }))
  })

  group.add(createInnerEnvelope())

  return group
}

const createEnvelope = () => {
  const group = new THREE.Group()
  group.position.set(0, envelopeBaseY, envelopeBaseZ)
  group.rotation.x = envelopeBaseRotationX
  group.rotation.z = -0.035
  group.scale.setScalar(envelopeBaseScale)

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 0.012, 1.1, 5, 0.018),
    new THREE.MeshStandardMaterial({
      map: createEnvelopeTexture(),
      roughness: 0.86,
      color: '#ffffff',
    })
  )
  body.rotation.x = Math.PI / 2
  body.position.z = 0.02
  body.castShadow = true
  body.receiveShadow = true

  const rim = new THREE.Mesh(
    new RoundedBoxGeometry(2.24, 0.007, 1.13, 5, 0.018),
    new THREE.MeshStandardMaterial({
      color: '#d6c7a9',
      roughness: 0.9,
      transparent: true,
      opacity: 0.08,
    })
  )
  rim.rotation.x = Math.PI / 2
  rim.position.z = 0.01

  const shadow = new THREE.Mesh(
    new RoundedBoxGeometry(2.22, 0.006, 1.1, 5, 0.018),
    new THREE.MeshBasicMaterial({
      color: '#8f7c62',
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
    })
  )
  shadow.rotation.x = Math.PI / 2
  shadow.position.set(0.025, -0.006, -0.024)

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

  camera = new THREE.PerspectiveCamera(introCameraStart.fov, 1, 0.1, 30)
  applyIntroCamera(0)

  const ambient = new THREE.HemisphereLight('#ffffff', '#d8ddd8', 1.34)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight('#ffffff', 1.58)
  keyLight.position.set(3.2, 4.8, 3.8)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  scene.add(keyLight)

  const fillLight = new THREE.PointLight('#c7dbe4', 0.54, 8)
  fillLight.position.set(-2.8, 1.8, 2.6)
  scene.add(fillLight)

  boxGroup = new THREE.Group()
  boxGroup.position.set(0, 0.02, 0)
  boxGroup.scale.setScalar(boxBaseScale)
  scene.add(boxGroup)

  boxGroup.add(createOpenBoxShell())

  boxContentsGroup = createBoxContents()
  boxGroup.add(boxContentsGroup)

  lidGroup = createLidAssembly()
  boxGroup.add(lidGroup)

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

  const now = performance.now()
  const elapsed = now * 0.001
  const isExtracting = isExtractingEnvelope.value
  const shouldRenderScene = !isLetterOpen.value

  if (boxGroup && shouldRenderScene) {
    if (stage.value === 'intro' || isExtracting) {
      const introProgress = Math.min(1, (now - introStart) / introDuration)
      const extractionProgress = isExtracting
        ? easeOutCubic(clamp((now - extractionStart) / extractionDuration, 0, 1))
        : 0
      const progress = isExtracting ? Math.max(introProgress, extractionProgress) : introProgress
      applyIntroCamera(progress)
    }

    camera.lookAt(cameraLookAt)

    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.09
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.09
    currentZoom += (targetZoom - currentZoom) * 0.12
    boxGroup.rotation.x = currentRotation.x
    boxGroup.rotation.y = currentRotation.y
    boxGroup.scale.setScalar(boxBaseScale * currentZoom)
  }

  if (envelopeGroup && shouldRenderScene) {
    envelopeGroup.visible = !envelopeDismissed.value
    if (envelopeGroup.visible) {
      envelopeGroup.position.y =
        envelopeBaseY + Math.sin(elapsed * 2.2) * envelopeFloatAmplitude
      envelopeGroup.position.z = envelopeBaseZ
      envelopeGroup.rotation.x = envelopeBaseRotationX
      envelopeGroup.rotation.z =
        -0.06 + Math.sin(elapsed * 1.7) * 0.018
      envelopeGroup.scale.setScalar(envelopeBaseScale)
    }
  }

  updateEnvelopeHotspot()
  updateLidHotspot()
  if (!shouldRenderScene) return

  renderer?.render(scene, camera)
}

const onPointerDown = (event) => {
  if (isLetterOpen.value || isBoxOpening.value) return

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  setCanvasPointerCapture(event.pointerId)

  if (activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()]
    isDragging = false
    isPinching = true
    pinchStartDistance = Math.hypot(second.x - first.x, second.y - first.y)
    pinchStartZoom = targetZoom
    return
  }

  isDragging = true
  hasDragged.value = true
  previousPointer = { x: event.clientX, y: event.clientY }
}

const onPointerMove = (event) => {
  if (isLetterOpen.value || isBoxOpening.value) return

  if (activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  if (isPinching && activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()]
    const nextDistance = Math.hypot(second.x - first.x, second.y - first.y)

    if (pinchStartDistance > 0) {
      targetZoom = clamp(pinchStartZoom * (nextDistance / pinchStartDistance), boxMinZoom, boxMaxZoom)
    }

    return
  }

  if (!isDragging) return

  const deltaX = event.clientX - previousPointer.x
  const deltaY = event.clientY - previousPointer.y
  previousPointer = { x: event.clientX, y: event.clientY }

  targetRotation.y += deltaX * 0.009
  targetRotation.x += deltaY * 0.006
  targetRotation.x = Math.max(-0.62, Math.min(0.38, targetRotation.x))
}

const onPointerUp = (event) => {
  activePointers.delete(event.pointerId)
  isDragging = false

  if (activePointers.size < 2) {
    isPinching = false
    pinchStartDistance = 0
  }

  releaseCanvasPointerCapture(event.pointerId)
}

const onWheel = (event) => {
  if (isLetterOpen.value || isBoxOpening.value) return

  targetZoom = clamp(targetZoom - event.deltaY * 0.0014, boxMinZoom, boxMaxZoom)
}

onMounted(async () => {
  await createScene()
  await nextTick()
  startAmbientGsap()

  introTimer = window.setTimeout(() => {
    stage.value = 'ready'
  }, introDuration)

  resizeObserver = new ResizeObserver(updateSize)
  resizeObserver.observe(canvasRef.value)
  window.addEventListener('resize', updateSize)
})

onBeforeUnmount(() => {
  stopLetterGsap()
  stopLidAnimation()
  killGsapContext(ambientContext)
  window.clearTimeout(beginTypingTimer)
  window.clearTimeout(introTimer)
  window.clearInterval(typeTimer)
  window.cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', updateSize)
  resizeObserver?.disconnect()
  renderer?.dispose()
})
</script>

<template>
  <main ref="rootRef" class="start-scene" :class="[`is-${stage}`, { 'letter-open': isLetterOpen }]">
    <div class="ambient-layer" aria-hidden="true">
      <span class="ribbon ribbon-a"></span>
      <span class="ribbon ribbon-b"></span>
      <span class="ribbon ribbon-c"></span>
    </div>

    <section class="three-stage" aria-label="3D 礼物箱">
      <canvas
        ref="canvasRef"
        class="gift-canvas"
        aria-label="可以拖动旋转查看的礼物箱"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
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

      <button
        ref="lidHotspotRef"
        class="lid-hotspot"
        type="button"
        :aria-disabled="!canOpenLid"
        :disabled="!canOpenLid"
        aria-label="打开箱子盖"
        @click="openLid"
      >
        <span class="lid-cue" aria-hidden="true">
          <span class="lid-cue-line"></span>
        </span>
      </button>

      <p v-if="hintText" class="drag-hint">{{ hintText }}</p>
    </section>

    <div class="letter-mask" aria-hidden="true"></div>
    <section class="letter-dialog" aria-label="信件内容">
      <div class="letter-scene">
        <button class="letter-close" type="button" aria-label="关闭信件" @click="closeLetter">
          <span aria-hidden="true"></span>
        </button>

        <article class="letter-paper">
          <span class="paper-tape" aria-hidden="true"></span>
          <span class="paper-rose" aria-hidden="true"></span>
          <span class="paper-heart paper-heart-one" aria-hidden="true"></span>
          <span class="paper-heart paper-heart-two" aria-hidden="true"></span>
          <span class="paper-heart paper-heart-three" aria-hidden="true"></span>
          <span class="paper-fx-layer" aria-hidden="true">
            <span class="paper-fx-heart paper-fx-heart-one"></span>
            <span class="paper-fx-heart paper-fx-heart-two"></span>
            <span class="paper-fx-heart paper-fx-heart-three"></span>
            <span class="paper-fx-heart paper-fx-heart-four"></span>
            <span class="paper-fx-heart paper-fx-heart-five"></span>
            <span class="paper-fx-heart paper-fx-heart-six"></span>
          </span>
          <span class="paper-sparkles" aria-hidden="true">
            <span class="paper-sparkles-heart">♥</span>
            <span class="paper-sparkles-glow"></span>
            <span class="paper-sparkle paper-sparkle-one"></span>
            <span class="paper-sparkle paper-sparkle-two"></span>
            <span class="paper-sparkle paper-sparkle-three"></span>
          </span>
          <div class="letter-content">
            <p class="typewriter">{{ typedText }}<span v-if="stage === 'typing'" class="caret"></span></p>
            <p v-if="showLetterSign" class="letter-sign">
              爱你呀<span class="sign-heart" aria-hidden="true"><span class="sign-heart-float">♥</span></span>
            </p>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
