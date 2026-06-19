<script setup lang="ts">
import { computed } from 'vue'
import { useFluidStore } from '../store/fluid'
import { PRESETS } from '../utils/sph-engine'
import type { Preset, SimParams } from '../types'

const store = useFluidStore()

function selectPreset(preset: Preset) {
  store.initSimulation(preset)
}

function toggleRun() {
  if (store.isRunning) {
    store.stop()
  } else {
    store.start()
  }
}

function reset() {
  store.reset()
}

function stepOnce() {
  store.stepOnce()
}

function onGravity(e: Event) {
  store.updateParam('gravity', parseFloat((e.target as HTMLInputElement).value))
}
function onViscosity(e: Event) {
  store.updateParam('viscosity', parseFloat((e.target as HTMLInputElement).value))
}
function onSmoothingRadius(e: Event) {
  store.updateParam('smoothingRadius', parseFloat((e.target as HTMLInputElement).value))
}
function onParticleCount(e: Event) {
  store.particleCount = parseInt((e.target as HTMLInputElement).value)
}
function onDt(e: Event) {
  store.updateParam('dt', parseFloat((e.target as HTMLInputElement).value))
}

// ---- 参数变化前后摘要 ----
const PARAM_LABELS: Record<keyof SimParams, string> = {
  gravity: '重力',
  viscosity: '粘性',
  restDensity: '静止密度',
  gasConstant: '气体常数',
  smoothingRadius: '光滑半径',
  particleMass: '粒子质量',
  dt: '时间步长',
  damping: '阻尼',
  boundaryStiffness: '边界刚度',
}

function formatParam(key: keyof SimParams, value: number): string {
  if (key === 'dt') return value.toFixed(4)
  if (key === 'smoothingRadius') return value.toFixed(0)
  return value.toFixed(1)
}

function barWidth(before: number, after: number, which: 'before' | 'after'): string {
  const max = Math.max(before, after, 1)
  const v = which === 'before' ? before : after
  return `${Math.min(100, (v / max) * 100)}%`
}

const paramLabel = computed(() => {
  const s = store.paramSummary
  return s ? PARAM_LABELS[s.paramName] : ''
})
const beforeValueText = computed(() => {
  const s = store.paramSummary
  return s ? formatParam(s.paramName, s.beforeValue) : ''
})
const afterValueText = computed(() => {
  const s = store.paramSummary
  return s ? formatParam(s.paramName, s.afterValue) : ''
})
const beforeDensity = computed(() => store.paramSummary?.beforeDensity ?? 0)
const afterDensity = computed(() => store.paramSummary?.afterDensity ?? 0)
const beforeVelocity = computed(() => store.paramSummary?.beforeVelocity ?? 0)
const afterVelocity = computed(() => store.paramSummary?.afterVelocity ?? 0)
const densityDelta = computed(() => afterDensity.value - beforeDensity.value)
const velocityDelta = computed(() => afterVelocity.value - beforeVelocity.value)
const densityDeltaPct = computed(() => {
  if (beforeDensity.value === 0) return 0
  return (densityDelta.value / beforeDensity.value) * 100
})
const velocityDeltaPct = computed(() => {
  if (beforeVelocity.value === 0) return 0
  return (velocityDelta.value / beforeVelocity.value) * 100
})
const measuringLabel = computed(() => {
  if (store.isDebouncing) return '等待参数稳定…'
  if (store.isMeasuring) return '正在测量变化效果…'
  return ''
})
</script>

<template>
  <div class="w-72 bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col gap-4 overflow-auto h-full">
    <!-- Presets -->
    <div>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">预设场景</h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in PRESETS"
          :key="preset.name"
          @click="selectPreset(preset)"
          class="text-xs px-2 py-2 rounded transition text-left"
          :class="store.currentPreset.name === preset.name
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
        >
          {{ preset.label }}
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">{{ store.currentPreset.description }}</p>
    </div>

    <!-- Controls -->
    <div class="flex gap-2">
      <button
        @click="toggleRun"
        class="flex-1 py-2 rounded text-sm font-medium transition"
        :class="store.isRunning
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'"
      >
        {{ store.isRunning ? '暂停' : '开始' }}
      </button>
      <button
        @click="reset"
        class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded text-sm transition"
      >
        重置
      </button>
      <button
        @click="stepOnce"
        :disabled="store.isRunning"
        class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 py-2 rounded text-sm transition"
      >
        单步
      </button>
    </div>

    <!-- Parameters -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">模拟参数</h3>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>重力</span>
          <span class="text-gray-300">{{ store.params.gravity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="20" step="0.1"
          :value="store.params.gravity"
          @input="onGravity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粘性</span>
          <span class="text-gray-300">{{ store.params.viscosity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="5" step="0.1"
          :value="store.params.viscosity"
          @input="onViscosity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>光滑半径</span>
          <span class="text-gray-300">{{ store.params.smoothingRadius.toFixed(0) }}</span>
        </label>
        <input
          type="range" min="10" max="50" step="1"
          :value="store.params.smoothingRadius"
          @input="onSmoothingRadius"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粒子数量</span>
          <span class="text-gray-300">{{ store.particleCount }}</span>
        </label>
        <input
          type="range" min="200" max="2000" step="50"
          :value="store.particleCount"
          @input="onParticleCount"
          class="w-full accent-blue-500 h-1.5"
        />
        <p class="text-xs text-gray-600 mt-0.5">重置后生效</p>
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>时间步长</span>
          <span class="text-gray-300">{{ store.params.dt.toFixed(4) }}</span>
        </label>
        <input
          type="range" min="0.001" max="0.02" step="0.001"
          :value="store.params.dt"
          @input="onDt"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>
    </div>

    <!-- 参数变化前后摘要 -->
    <div
      v-if="store.paramSummary || store.isMeasuring || store.isDebouncing"
      class="rounded-lg border border-blue-600/50 bg-gradient-to-b from-blue-900/20 to-gray-900/60 p-3 shadow-lg shadow-blue-900/20"
    >
      <h3 class="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
        参数变化对比
      </h3>

      <div v-if="store.isDebouncing || store.isMeasuring" class="space-y-2">
        <p class="text-xs text-gray-400">{{ measuringLabel }}</p>
        <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-150"
            :style="{ width: store.measureProgress + '%' }"
          ></div>
        </div>
      </div>

      <template v-else>
        <!-- 变化的参数 -->
        <div class="flex items-center justify-between text-xs mb-3 pb-2 border-b border-gray-700/50">
          <span class="text-gray-400 font-medium">{{ paramLabel }}</span>
          <span class="font-mono">
            <span class="text-gray-500">{{ beforeValueText }}</span>
            <span class="text-blue-400 mx-1.5">→</span>
            <span class="text-white font-semibold">{{ afterValueText }}</span>
          </span>
        </div>

        <!-- 平均密度 -->
        <div class="mb-3">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-400">平均密度</span>
            <div class="flex items-center gap-1">
              <span
                class="font-mono text-sm font-semibold"
                :class="densityDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ densityDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(densityDelta).toFixed(0) }}
              </span>
              <span
                v-if="beforeDensity > 0"
                class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                :class="densityDelta >= 0 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'"
              >
                {{ densityDelta >= 0 ? '+' : '' }}{{ densityDeltaPct.toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-mono mb-1">
            <span class="text-gray-500 w-5">前</span>
            <div class="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-gray-500 rounded-full transition-all duration-500"
                :style="{ width: barWidth(beforeDensity, afterDensity, 'before') }"
              ></div>
            </div>
            <span class="text-gray-400 w-12 text-right">{{ beforeDensity.toFixed(0) }}</span>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-mono">
            <span class="text-yellow-400 w-5 font-semibold">后</span>
            <div class="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500"
                :style="{ width: barWidth(beforeDensity, afterDensity, 'after') }"
              ></div>
            </div>
            <span class="text-yellow-400 w-12 text-right font-semibold">{{ afterDensity.toFixed(0) }}</span>
          </div>
        </div>

        <!-- 最大速度 -->
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-400">最大速度</span>
            <div class="flex items-center gap-1">
              <span
                class="font-mono text-sm font-semibold"
                :class="velocityDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ velocityDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(velocityDelta).toFixed(1) }}
              </span>
              <span
                v-if="beforeVelocity > 0"
                class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                :class="velocityDelta >= 0 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'"
              >
                {{ velocityDelta >= 0 ? '+' : '' }}{{ velocityDeltaPct.toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-mono mb-1">
            <span class="text-gray-500 w-5">前</span>
            <div class="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-gray-500 rounded-full transition-all duration-500"
                :style="{ width: barWidth(beforeVelocity, afterVelocity, 'before') }"
              ></div>
            </div>
            <span class="text-gray-400 w-12 text-right">{{ beforeVelocity.toFixed(1) }}</span>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-mono">
            <span class="text-red-400 w-5 font-semibold">后</span>
            <div class="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-500"
                :style="{ width: barWidth(beforeVelocity, afterVelocity, 'after') }"
              ></div>
            </div>
            <span class="text-red-400 w-12 text-right font-semibold">{{ afterVelocity.toFixed(1) }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- Stats -->
    <div class="mt-auto pt-3 border-t border-gray-700">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">运行状态</h3>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">FPS</span>
          <p class="text-green-400 font-mono text-sm">{{ store.fps }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">粒子数</span>
          <p class="text-blue-400 font-mono text-sm">{{ store.particleArray.length }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">平均密度</span>
          <p class="text-yellow-400 font-mono text-sm">{{ store.avgDensity.toFixed(0) }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">最大速度</span>
          <p class="text-red-400 font-mono text-sm">{{ store.maxVelocity.toFixed(1) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
