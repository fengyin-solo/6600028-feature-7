import { defineStore } from 'pinia'
import { SPHEngine, DEFAULT_PARAMS, PRESETS } from '../utils/sph-engine'
import type { SimParams, Preset, Particle, ParamSummary } from '../types'

const MEASURE_FRAMES = 30
const PAUSED_MEASURE_FRAMES = 20
const DEBOUNCE_MS = 150

export const useFluidStore = defineStore('fluid', {
  state: () => ({
    engine: null as SPHEngine | null,
    isRunning: false,
    particleCount: 800,
    currentPreset: PRESETS[0],
    params: { ...DEFAULT_PARAMS } as SimParams,
    fps: 0,
    frameCount: 0,
    _animId: null as number | null,
    _lastTime: 0,
    _fpsAccum: 0,
    _fpsFrames: 0,
    _pendingMeasurement: null as null | {
      paramName: keyof SimParams
      beforeValue: number
      beforeDensity: number
      beforeVelocity: number
      targetFrame: number
      remainingSteps: number
    },
    _debounceTimer: null as number | null,
    paramSummary: null as ParamSummary | null,
  }),
  getters: {
    particleArray: (state) => state.engine?.particles ?? [],
    avgDensity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      const sum = state.engine.particles.reduce((s, p) => s + p.density, 0)
      return sum / state.engine.particles.length
    },
    maxVelocity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      return Math.max(...state.engine.particles.map(p => Math.sqrt(p.vx * p.vx + p.vy * p.vy)))
    },
    isMeasuring: (state) => state._pendingMeasurement !== null && state._debounceTimer === null,
    isDebouncing: (state) => state._pendingMeasurement !== null && state._debounceTimer !== null,
    measureProgress: (state) => {
      const m = state._pendingMeasurement
      if (!m || m.targetFrame === 0) return 0
      const total = state.isRunning ? MEASURE_FRAMES : PAUSED_MEASURE_FRAMES
      const remaining = state.isRunning 
        ? Math.max(0, m.targetFrame - state.frameCount)
        : m.remainingSteps
      return Math.min(100, Math.max(0, ((total - remaining) / total) * 100))
    },
  },
  actions: {
    initSimulation(preset?: Preset) {
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
        this._debounceTimer = null
      }
      if (preset) {
        this.currentPreset = preset
        this.params = { ...DEFAULT_PARAMS, ...preset.params }
        this.particleCount = preset.particleCount
      }
      const canvas = { width: 800, height: 500 }
      this.engine = new SPHEngine(this.particleCount, canvas.width, canvas.height, this.params)
      this.engine.initParticles(this.currentPreset.initialConfig, this.particleCount)
      this.frameCount = 0
      this.fps = 0
      this._pendingMeasurement = null
      this.paramSummary = null
    },
    start() {
      if (this.isRunning || !this.engine) return
      this.isRunning = true
      this._lastTime = performance.now()
      this._fpsAccum = 0
      this._fpsFrames = 0
      const loop = (now: number) => {
        if (!this.isRunning || !this.engine) return
        const elapsed = now - this._lastTime
        this._lastTime = now
        this._fpsAccum += elapsed
        this._fpsFrames++
        if (this._fpsAccum >= 500) {
          this.fps = Math.round(this._fpsFrames / (this._fpsAccum / 1000))
          this._fpsAccum = 0
          this._fpsFrames = 0
        }
        // Sub-steps for stability
        const subSteps = 3
        for (let s = 0; s < subSteps; s++) {
          this.engine.step()
        }
        this.frameCount++
        this._checkPendingMeasurement()
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },
    stop() {
      this.isRunning = false
      if (this._animId !== null) {
        cancelAnimationFrame(this._animId)
        this._animId = null
      }
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
        this._debounceTimer = null
      }
    },
    reset() {
      this.stop()
      this.initSimulation(this.currentPreset)
    },
    stepOnce() {
      if (!this.engine || this.isRunning) return
      const subSteps = 3
      for (let s = 0; s < subSteps; s++) {
        this.engine.step()
      }
      this.frameCount++
      this._checkPendingMeasurement()
    },
    updateParam(key: keyof SimParams, value: number) {
      const oldPending = this._pendingMeasurement
      const isSameParam = oldPending && oldPending.paramName === key

      const beforeValue = isSameParam ? oldPending!.beforeValue : this.params[key]
      const beforeDensity = isSameParam ? oldPending!.beforeDensity : this.avgDensity
      const beforeVelocity = isSameParam ? oldPending!.beforeVelocity : this.maxVelocity

      this.params[key] = value
      if (this.engine) {
        this.engine.params[key] = value
        if (key === 'smoothingRadius') {
          this.engine['cellSize'] = value
        }
      }

      this._pendingMeasurement = {
        paramName: key,
        beforeValue: beforeValue,
        beforeDensity: beforeDensity,
        beforeVelocity: beforeVelocity,
        targetFrame: 0,
        remainingSteps: 0,
      }

      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
      }

      this._debounceTimer = window.setTimeout(() => {
        this._debounceTimer = null
        const m = this._pendingMeasurement
        if (!m) return
        const measureFrames = this.isRunning ? MEASURE_FRAMES : PAUSED_MEASURE_FRAMES
        m.targetFrame = this.frameCount + measureFrames
        m.remainingSteps = measureFrames
        if (!this.isRunning && this.engine) {
          this._runPausedMeasurement()
        }
      }, DEBOUNCE_MS)
    },
    _runPausedMeasurement() {
      const m = this._pendingMeasurement
      if (!m || !this.engine || this.isRunning) return

      const subSteps = 3
      const totalFrames = m.remainingSteps
      for (let i = 0; i < totalFrames; i++) {
        for (let s = 0; s < subSteps; s++) {
          this.engine.step()
        }
        this.frameCount++
      }
      this._finalizeMeasurement()
    },
    _checkPendingMeasurement() {
      const m = this._pendingMeasurement
      if (!m || m.targetFrame === 0 || this.frameCount < m.targetFrame) return
      this._finalizeMeasurement()
    },
    _finalizeMeasurement() {
      const m = this._pendingMeasurement
      if (!m) return
      this.paramSummary = {
        paramName: m.paramName,
        beforeValue: m.beforeValue,
        afterValue: this.params[m.paramName],
        beforeDensity: m.beforeDensity,
        afterDensity: this.avgDensity,
        beforeVelocity: m.beforeVelocity,
        afterVelocity: this.maxVelocity,
      }
      this._pendingMeasurement = null
    },
  },
})
