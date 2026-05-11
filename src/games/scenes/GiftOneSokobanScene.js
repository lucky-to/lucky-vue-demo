import * as Phaser from 'phaser'
import { gsap } from 'gsap'
import loveSokobanSprites from '../../assets/game/love-sokoban-sprites.png'

const TILE_SIZE = 72
const BOARD_SIZE = 5
const WALLS = new Set(['0-0', '0-1', '0-2', '0-3', '0-4', '1-0', '1-4', '2-0', '2-4', '3-0', '3-4', '4-0', '4-1', '4-2', '4-3', '4-4'])
const TARGET = { row: 1, col: 3 }
const START_PLAYER = { row: 3, col: 1 }
const START_BOX = { row: 2, col: 2 }

export default class GiftOneSokobanScene extends Phaser.Scene {
  constructor() {
    super('GiftOneSokobanScene')
    this.isMoving = false
    this.moveCount = 0
  }

  preload() {
    this.load.spritesheet('love-sokoban', loveSokobanSprites, {
      frameWidth: 625,
      frameHeight: 625,
    })
  }

  create() {
    this.onComplete = this.game.config.customOnComplete
    this.onMessage = this.game.config.customOnMessage
    this.onMove = this.game.config.customOnMove
    this.boardOffset = {
      x: (this.scale.width - BOARD_SIZE * TILE_SIZE) / 2,
      y: 20,
    }

    this.player = { ...START_PLAYER }
    this.box = { ...START_BOX }
    this.moveCount = 0
    this.isMoving = false

    this.createBoard()
    this.createPieces()
    this.bindInput()
    this.emitMessage('把礼物盒推到发光的心上，就能打开第一份礼物。')
    this.emitMove()
  }

  createBoard() {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const { x, y } = this.toWorld(row, col)
        const key = `${row}-${col}`
        const isWall = WALLS.has(key)
        const isTarget = row === TARGET.row && col === TARGET.col

        const tile = this.add.rectangle(x, y, TILE_SIZE - 6, TILE_SIZE - 6, isWall ? 0xf1c7d2 : 0xfffbfc, 1)
        tile.setStrokeStyle(2, isWall ? 0xc78ca0 : 0xf8bfd0, 0.9)
        tile.setOrigin(0.5)

        if (isTarget) {
          this.add.image(x, y, 'love-sokoban', 2).setDisplaySize(54, 54).setAlpha(0.82)
        }
      }
    }
  }

  createPieces() {
    const boxWorld = this.toWorld(this.box.row, this.box.col)
    const playerWorld = this.toWorld(this.player.row, this.player.col)

    this.boxSprite = this.add.image(boxWorld.x, boxWorld.y, 'love-sokoban', 1)
    this.boxSprite.setDisplaySize(62, 62)

    this.playerSprite = this.add.image(playerWorld.x, playerWorld.y, 'love-sokoban', 0)
    this.playerSprite.setDisplaySize(62, 62)

    gsap.to(this.playerSprite, {
      y: playerWorld.y - 4,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })
  }

  bindInput() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.input.keyboard.on('keydown-W', () => this.tryMove(-1, 0))
    this.input.keyboard.on('keydown-A', () => this.tryMove(0, -1))
    this.input.keyboard.on('keydown-S', () => this.tryMove(1, 0))
    this.input.keyboard.on('keydown-D', () => this.tryMove(0, 1))

    this.game.events.on('love-sokoban-move', this.handleExternalMove, this)
    this.game.events.on('love-sokoban-reset', this.resetLevel, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('love-sokoban-move', this.handleExternalMove, this)
      this.game.events.off('love-sokoban-reset', this.resetLevel, this)
    })
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.tryMove(-1, 0)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.tryMove(1, 0)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.tryMove(0, -1)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.tryMove(0, 1)
  }

  handleExternalMove(direction) {
    const vectors = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    }
    const vector = vectors[direction]

    if (vector) {
      this.tryMove(vector[0], vector[1])
    }
  }

  tryMove(rowDelta, colDelta) {
    if (this.isMoving || this.isComplete) return

    const nextPlayer = {
      row: this.player.row + rowDelta,
      col: this.player.col + colDelta,
    }

    if (this.isBlocked(nextPlayer)) {
      this.emitMessage('这边被挡住啦，换一条路试试。')
      return
    }

    const pushingBox = this.samePosition(nextPlayer, this.box)
    let nextBox = null

    if (pushingBox) {
      nextBox = {
        row: this.box.row + rowDelta,
        col: this.box.col + colDelta,
      }

      if (this.isBlocked(nextBox)) {
        this.emitMessage('礼物盒推不动啦，要从另一个方向靠近它。')
        return
      }
    }

    this.player = nextPlayer
    if (nextBox) this.box = nextBox

    this.moveCount += 1
    this.emitMove()
    this.animateMove(nextBox)
  }

  animateMove(nextBox) {
    this.isMoving = true
    const playerWorld = this.toWorld(this.player.row, this.player.col)
    const tweens = [
      new Promise((resolve) => {
        this.tweens.add({
          targets: this.playerSprite,
          x: playerWorld.x,
          y: playerWorld.y,
          duration: 160,
          ease: 'Sine.easeInOut',
          onComplete: resolve,
        })
      }),
    ]

    if (nextBox) {
      const boxWorld = this.toWorld(this.box.row, this.box.col)
      tweens.push(new Promise((resolve) => {
        this.tweens.add({
          targets: this.boxSprite,
          x: boxWorld.x,
          y: boxWorld.y,
          duration: 160,
          ease: 'Sine.easeInOut',
          onComplete: resolve,
        })
      }))
    }

    Promise.all(tweens).then(() => {
      this.isMoving = false
      this.checkComplete()
    })
  }

  checkComplete() {
    if (!this.samePosition(this.box, TARGET)) {
      this.emitMessage('很好，再把礼物盒推到发光的心上。')
      return
    }

    this.isComplete = true
    this.emitMessage('通关成功。礼物盒已经送到心上啦。')

    gsap.to(this.boxSprite, {
      scale: 1.16,
      duration: 0.28,
      repeat: 3,
      yoyo: true,
      ease: 'sine.inOut',
      onComplete: () => this.onComplete?.(),
    })
  }

  resetLevel() {
    this.player = { ...START_PLAYER }
    this.box = { ...START_BOX }
    this.moveCount = 0
    this.isMoving = false
    this.isComplete = false

    const playerWorld = this.toWorld(this.player.row, this.player.col)
    const boxWorld = this.toWorld(this.box.row, this.box.col)
    this.playerSprite.setPosition(playerWorld.x, playerWorld.y)
    this.boxSprite.setPosition(boxWorld.x, boxWorld.y)
    this.boxSprite.setScale(1)
    this.emitMove()
    this.emitMessage('把礼物盒推到发光的心上，就能打开第一份礼物。')
  }

  isBlocked(position) {
    return (
      position.row < 0 ||
      position.row >= BOARD_SIZE ||
      position.col < 0 ||
      position.col >= BOARD_SIZE ||
      WALLS.has(`${position.row}-${position.col}`)
    )
  }

  samePosition(first, second) {
    return first.row === second.row && first.col === second.col
  }

  toWorld(row, col) {
    return {
      x: this.boardOffset.x + col * TILE_SIZE + TILE_SIZE / 2,
      y: this.boardOffset.y + row * TILE_SIZE + TILE_SIZE / 2,
    }
  }

  emitMessage(message) {
    this.onMessage?.(message)
  }

  emitMove() {
    this.onMove?.(this.moveCount)
  }
}
