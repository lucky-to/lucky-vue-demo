<script setup>
import * as Phaser from 'phaser'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GiftOneSokobanScene from './scenes/GiftOneSokobanScene'

const emit = defineEmits(['complete', 'message', 'move'])

const gameHost = ref(null)
let game = null

const createGame = () => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameHost.value,
    width: 390,
    height: 430,
    backgroundColor: '#fff1f2',
    transparent: true,
    customOnComplete: () => emit('complete'),
    customOnMessage: (message) => emit('message', message),
    customOnMove: (moves) => emit('move', moves),
    scene: [GiftOneSokobanScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}

const move = (direction) => {
  game?.events.emit('love-sokoban-move', direction)
}

const reset = () => {
  game?.events.emit('love-sokoban-reset')
}

onMounted(createGame)

onBeforeUnmount(() => {
  game?.destroy(true)
  game = null
})

defineExpose({ move, reset })
</script>

<template>
  <div ref="gameHost" class="phaser-host"></div>
</template>
