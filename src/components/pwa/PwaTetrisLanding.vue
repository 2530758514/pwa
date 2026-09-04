<script setup>
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'

defineOptions({
  name: 'PwaTetrisLanding',
})

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const CELL_SIZE = 30
const DROP_INTERVAL_MS = 650
const PIECES = [
  { color: '#35d2ff', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { color: '#ffd449', cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  { color: '#b58cff', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { color: '#70e889', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { color: '#ff6d91', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { color: '#4d92ff', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { color: '#ff9d4d', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
]

const canvasRef = useTemplateRef('canvas')
const score = shallowRef(0)
const lines = shallowRef(0)
const isGameOver = shallowRef(false)
const statusText = computed(() => (isGameOver.value ? 'Game over' : 'Playing'))

let board = []
let currentPiece = null
let dropTimer = null

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(''))
}

function createPiece() {
  const source = PIECES[Math.floor(Math.random() * PIECES.length)]

  return {
    color: source.color,
    cells: source.cells.map(([x, y]) => [x, y]),
    x: 3,
    y: 0,
  }
}

function getCanvasContext() {
  return canvasRef.value?.getContext('2d') || null
}

function canPlace(piece, offsetX = 0, offsetY = 0, cells = piece.cells) {
  return cells.every(([cellX, cellY]) => {
    const x = piece.x + cellX + offsetX
    const y = piece.y + cellY + offsetY

    return x >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT && (y < 0 || !board[y][x])
  })
}

function drawCell(context, x, y, color) {
  context.fillStyle = color || '#202938'
  context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  context.strokeStyle = '#101722'
  context.lineWidth = 1
  context.strokeRect(x * CELL_SIZE + 0.5, y * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
}

function drawBoard() {
  const context = getCanvasContext()
  if (!context) return

  context.clearRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE)
  board.forEach((row, y) => row.forEach((color, x) => drawCell(context, x, y, color)))
  if (!currentPiece) return

  currentPiece.cells.forEach(([cellX, cellY]) => {
    const x = currentPiece.x + cellX
    const y = currentPiece.y + cellY
    if (y >= 0) drawCell(context, x, y, currentPiece.color)
  })
}

function clearCompletedLines() {
  const remainingRows = board.filter((row) => row.some((cell) => !cell))
  const cleared = BOARD_HEIGHT - remainingRows.length
  if (!cleared) return

  board = [
    ...Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill('')),
    ...remainingRows,
  ]
  lines.value += cleared
  score.value += [0, 100, 300, 500, 800][cleared] || cleared * 200
}

function lockCurrentPiece() {
  currentPiece.cells.forEach(([cellX, cellY]) => {
    const x = currentPiece.x + cellX
    const y = currentPiece.y + cellY
    if (y >= 0) board[y][x] = currentPiece.color
  })

  clearCompletedLines()
  currentPiece = createPiece()
  if (!canPlace(currentPiece)) {
    isGameOver.value = true
    window.clearInterval(dropTimer)
    dropTimer = null
  }
}

function stepDown() {
  if (isGameOver.value || !currentPiece) return

  if (canPlace(currentPiece, 0, 1)) {
    currentPiece.y += 1
  } else {
    lockCurrentPiece()
  }
  drawBoard()
}

function moveHorizontally(offset) {
  if (isGameOver.value || !currentPiece || !canPlace(currentPiece, offset, 0)) return

  currentPiece.x += offset
  drawBoard()
}

function rotatePiece() {
  if (isGameOver.value || !currentPiece) return

  const rotatedCells = currentPiece.cells.map(([x, y]) => [-y + 1, x])
  const normalizedX = Math.min(...rotatedCells.map(([x]) => x))
  const normalizedY = Math.min(...rotatedCells.map(([, y]) => y))
  const normalizedCells = rotatedCells.map(([x, y]) => [x - normalizedX, y - normalizedY])

  if (!canPlace(currentPiece, 0, 0, normalizedCells)) return

  currentPiece.cells = normalizedCells
  drawBoard()
}

function hardDrop() {
  if (isGameOver.value || !currentPiece) return

  while (canPlace(currentPiece, 0, 1)) currentPiece.y += 1
  lockCurrentPiece()
  drawBoard()
}

function restartGame() {
  board = createEmptyBoard()
  currentPiece = createPiece()
  score.value = 0
  lines.value = 0
  isGameOver.value = false
  window.clearInterval(dropTimer)
  dropTimer = window.setInterval(stepDown, DROP_INTERVAL_MS)
  drawBoard()
}

function handleKeydown(event) {
  const actions = {
    ArrowLeft: () => moveHorizontally(-1),
    ArrowRight: () => moveHorizontally(1),
    ArrowDown: stepDown,
    ArrowUp: rotatePiece,
    ' ': hardDrop,
  }
  const action = actions[event.key]
  if (!action) return

  event.preventDefault()
  action()
}

onMounted(() => {
  restartGame()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.clearInterval(dropTimer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <main class="tetris-page">
    <section class="tetris-card" aria-label="Tetris game">
      <div class="score-row" aria-live="polite">
        <span>Score <strong>{{ score }}</strong></span>
        <span>Lines <strong>{{ lines }}</strong></span>
        <span :class="{ 'game-over': isGameOver }">{{ statusText }}</span>
      </div>

      <canvas
        ref="canvas"
        class="tetris-board"
        :width="BOARD_WIDTH * CELL_SIZE"
        :height="BOARD_HEIGHT * CELL_SIZE"
        aria-label="Tetris board"
      />

      <p v-if="isGameOver" class="game-over-message">Tap Restart to play again.</p>
      <p v-else class="instructions">Use the controls below, or keyboard arrows.</p>

      <div class="control-pad" aria-label="Tetris controls">
        <button class="restart-button" type="button" @pointerdown.prevent="restartGame">Restart</button>
        <button class="rotate-button" type="button" aria-label="Rotate" @pointerdown.prevent="rotatePiece">▲</button>
        <button class="left-button" type="button" aria-label="Move left" @pointerdown.prevent="moveHorizontally(-1)">◀</button>
        <button class="down-button" type="button" aria-label="Drop one row" @pointerdown.prevent="stepDown">▼</button>
        <button class="right-button" type="button" aria-label="Move right" @pointerdown.prevent="moveHorizontally(1)">▶</button>
        <button class="space-button" type="button" @pointerdown.prevent="hardDrop">SPACE</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.tetris-page {
  box-sizing: border-box;
  display: grid;
  position: fixed;
  z-index: 2147483646;
  inset: 0;
  min-height: 100dvh;
  place-items: center;
  overflow: hidden;
  padding: 10px 16px 24px;
  background: radial-gradient(circle at top, #253a63 0%, #101725 48%, #080d16 100%);
  color: #f7f9ff;
}

.tetris-card {
  box-sizing: border-box;
  display: flex;
  height: 100%;
  flex-direction: column;
  width: min(100%, 390px);
  padding: 0;
}

.score-row,
.control-pad {
  display: flex;
  align-items: center;
}

.restart-button,
.control-pad button {
  border: 0;
  border-radius: 12px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  touch-action: manipulation;
}

.restart-button {
  grid-area: restart;
  width: 100%;
  height: 100%;
  background: #283851;
}

.score-row {
  justify-content: space-between;
  margin: clamp(10px, 1.8dvh, 18px) 0 clamp(8px, 1.4dvh, 12px);
  color: #b9c8e4;
  font-size: 12px;
}

.score-row strong {
  margin-left: 4px;
  color: #fff;
}

.game-over {
  color: #ff91a7;
  font-weight: 800;
}

.tetris-board {
  display: block;
  width: min(100%, calc((100dvh - 222px) / 2));
  height: auto;
  margin: 0 auto;
  border: 2px solid #31425f;
  border-radius: 10px;
  background: #202938;
  image-rendering: pixelated;
}

.instructions,
.game-over-message {
  min-height: 16px;
  margin: clamp(8px, 1.4dvh, 12px) 0;
  color: #9fb0ce;
  font-size: 12px;
  text-align: center;
}

.game-over-message {
  color: #ffb0bf;
}

.control-pad {
  display: grid;
  grid-template-areas:
    '. rotate . restart restart'
    'left down right space space';
  grid-template-columns: repeat(5, 48px);
  grid-template-rows: repeat(2, 44px);
  justify-content: center;
  gap: 7px;
  margin-top: auto;
  margin-bottom: 4px;
}

.control-pad button {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: #283851;
  font-size: 23px;
}

.control-pad .rotate-button {
  grid-area: rotate;
}

.control-pad .left-button {
  grid-area: left;
}

.control-pad .down-button {
  grid-area: down;
}

.control-pad .right-button {
  grid-area: right;
}

.control-pad .space-button {
  grid-area: space;
  width: 100%;
  height: 44px;
  align-self: center;
  background: #283851;
}

.control-pad .restart-button,
.control-pad .space-button {
  font-size: 12px;
  letter-spacing: 0.08em;
}

@media (max-height: 620px) {
  .tetris-page {
    padding-block: 6px;
  }

  .score-row {
    margin-block: 7px;
  }

  .instructions,
  .game-over-message {
    margin-block: 6px;
  }
}

.restart-button:active,
.control-pad button:active {
  transform: translateY(1px);
  filter: brightness(1.2);
}
</style>
