import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const POD_COUNT = 20
/** Operator/override modes only (dropdown + legend). */
const MODES = ['Load', 'Unload', 'Up', 'Down', 'E-Stop']

/** Spec / real ride times (meta strip labels). */
const TIMINGS = {
  ride: 255,
  up: 100,
  down: 100,
  peak: 9,
  load: 45,
  unload: 45,
  spacingM: 20,
  velocityMs: 2,
}

/** Demo cycle: each stage advances in ~1s so the grid changes quickly. */
const DEMO_STAGE_S = 1

const HEADWAY_S = TIMINGS.spacingM / TIMINGS.velocityMs

const STAGE = {
  WAITING: 'waiting',
  LOAD: 'load',
  UP: 'up',
  PEAK: 'peak',
  DOWN: 'down',
  UNLOAD: 'unload',
  COMPLETE: 'complete',
  ESTOP: 'estop',
}

// Peak stays an automatic stage label; pods keep Up through demo peak.
const STAGE_ORDER = [
  { id: STAGE.LOAD, label: 'Load / Board', duration: DEMO_STAGE_S, mode: 'Load' },
  { id: STAGE.UP, label: 'Ascending (Up)', duration: DEMO_STAGE_S, mode: 'Up' },
  { id: STAGE.PEAK, label: 'Peak Transition', duration: DEMO_STAGE_S, mode: 'Up' },
  { id: STAGE.DOWN, label: 'Descending (Down)', duration: DEMO_STAGE_S, mode: 'Down' },
  { id: STAGE.UNLOAD, label: 'Unload / Alight', duration: DEMO_STAGE_S, mode: 'Unload' },
]

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function createPods() {
  return Array.from({ length: POD_COUNT }, (_, i) => ({
    id: i + 1,
    mode: null,
    iPad: '---',
    overridden: false,
  }))
}

function stageLine(stageId, remaining) {
  if (stageId === STAGE.WAITING) return 'Stage: Waiting for iPad Selections'
  if (stageId === STAGE.COMPLETE) return 'Stage: Cycle Complete'
  if (stageId === STAGE.ESTOP) return 'Stage: E-STOP ACTIVE'
  const stage = STAGE_ORDER.find((s) => s.id === stageId)
  if (!stage) return 'Stage: —'
  return `Stage: ${stage.label} — ${formatClock(remaining)} remaining`
}

function mapNonOverridden(pods, updater) {
  return pods.map((pod) => (pod.overridden ? pod : updater(pod)))
}

export default function App() {
  const [pods, setPods] = useState(createPods)
  const [stageId, setStageId] = useState(STAGE.WAITING)
  const [remaining, setRemaining] = useState(0)
  const [rideElapsed, setRideElapsed] = useState(0)
  const [cycleActive, setCycleActive] = useState(false)
  const [overridePod, setOverridePod] = useState(1)
  const [overrideMode, setOverrideMode] = useState('Down')

  const stageRef = useRef(stageId)
  const remainingRef = useRef(remaining)

  useEffect(() => {
    stageRef.current = stageId
  }, [stageId])

  useEffect(() => {
    remainingRef.current = remaining
  }, [remaining])

  const iPadReady = useMemo(
    () => pods.filter((p) => p.iPad === 'Selected' || p.iPad === 'Loaded').length,
    [pods],
  )

  useEffect(() => {
    if (!cycleActive) return undefined

    const tick = window.setInterval(() => {
      const current = stageRef.current
      if (
        current === STAGE.WAITING ||
        current === STAGE.COMPLETE ||
        current === STAGE.ESTOP
      ) {
        return
      }

      if (current === STAGE.UP || current === STAGE.PEAK || current === STAGE.DOWN) {
        setRideElapsed((prev) => Math.min(TIMINGS.ride, prev + 1))
      }

      const nextRemaining = remainingRef.current - 1
      if (nextRemaining > 0) {
        remainingRef.current = nextRemaining
        setRemaining(nextRemaining)
        return
      }

      const idx = STAGE_ORDER.findIndex((s) => s.id === current)
      const next = STAGE_ORDER[idx + 1]
      if (!next) {
        setStageId(STAGE.COMPLETE)
        stageRef.current = STAGE.COMPLETE
        setCycleActive(false)
        remainingRef.current = 0
        setRemaining(0)
        setPods((prev) =>
          mapNonOverridden(prev, (pod) => ({
            ...pod,
            mode: null,
            iPad: pod.iPad === '---' ? '---' : 'Loaded',
          })),
        )
        return
      }

      stageRef.current = next.id
      remainingRef.current = next.duration
      setStageId(next.id)
      setRemaining(next.duration)
      setPods((prev) => mapNonOverridden(prev, (pod) => ({ ...pod, mode: next.mode })))
    }, 1000)

    return () => window.clearInterval(tick)
  }, [cycleActive])

  function handleLoadIpad() {
    if (stageId === STAGE.ESTOP) return

    setPods((prev) =>
      prev.map((pod) => {
        if (pod.overridden) return pod
        const selected = Math.random() > 0.12
        return {
          ...pod,
          // iPad stays status text only — not a Mode option
          mode: pod.mode,
          iPad: selected ? 'Selected' : 'Pending',
        }
      }),
    )

    window.setTimeout(() => {
      setPods((prev) =>
        prev.map((pod) => {
          if (pod.overridden) return pod
          if (pod.iPad !== 'Selected') return { ...pod, mode: 'Load' }
          return { ...pod, mode: 'Load', iPad: 'Loaded' }
        }),
      )
      stageRef.current = STAGE.LOAD
      remainingRef.current = DEMO_STAGE_S
      setStageId(STAGE.LOAD)
      setRemaining(DEMO_STAGE_S)
      setRideElapsed(0)
      setCycleActive(true)
    }, 450)
  }

  function handleApplyOverride() {
    setPods((prev) =>
      prev.map((pod) =>
        pod.id === overridePod
          ? { ...pod, mode: overrideMode, overridden: true }
          : pod,
      ),
    )

    if (overrideMode === 'E-Stop') {
      stageRef.current = STAGE.ESTOP
      remainingRef.current = 0
      setStageId(STAGE.ESTOP)
      setCycleActive(false)
      setRemaining(0)
    }
  }

  function handleResetFleet() {
    setPods(createPods())
    stageRef.current = STAGE.WAITING
    remainingRef.current = 0
    setStageId(STAGE.WAITING)
    setRemaining(0)
    setRideElapsed(0)
    setCycleActive(false)
    setOverridePod(1)
    setOverrideMode('Down')
  }

  const showReset =
    stageId === STAGE.ESTOP ||
    stageId === STAGE.COMPLETE ||
    pods.some((p) => p.overridden)

  return (
    <div className="console">
      <header className="console__header">
        <h1>Override Console</h1>
        <p className={`console__stage${stageId === STAGE.ESTOP ? ' is-estop' : ''}`}>
          {stageLine(stageId, remaining)}
        </p>
        <p className="console__meta">
          <span>Ride {formatClock(TIMINGS.ride)}</span>
          <span>Up/Down {formatClock(TIMINGS.up)}</span>
          <span>Peak {TIMINGS.peak}s</span>
          <span>Load/Unload {TIMINGS.load}s</span>
          <span>
            Spacing {TIMINGS.spacingM}m @ {TIMINGS.velocityMs}m/s
          </span>
          <span>Headway {HEADWAY_S}s</span>
          <span>{POD_COUNT} pods</span>
          <span>
            iPad ready {iPadReady}/{POD_COUNT}
          </span>
          {(stageId === STAGE.UP || stageId === STAGE.PEAK || stageId === STAGE.DOWN) && (
            <span>Elapsed {formatClock(rideElapsed)}</span>
          )}
        </p>
      </header>

      <section className="pod-grid" aria-label="Pod status grid">
        {pods.map((pod) => {
          const modeDisplay = pod.mode == null ? '---' : pod.mode
          return (
            <article
              key={pod.id}
              className={`pod-tile${pod.overridden ? ' is-overridden' : ''}${
                pod.mode === 'E-Stop' ? ' is-estop' : ''
              }${overridePod === pod.id ? ' is-selected' : ''}`}
              onClick={() => setOverridePod(pod.id)}
            >
              <div className="pod-tile__name">Pod {pod.id}</div>
              <div>Mode: {modeDisplay}</div>
              <div>iPad: {pod.iPad}</div>
            </article>
          )
        })}
      </section>

      <div className="console__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleLoadIpad}
          disabled={stageId === STAGE.ESTOP}
        >
          Load iPad Selections
        </button>
        {showReset && (
          <button type="button" className="btn btn--ghost" onClick={handleResetFleet}>
            Reset Fleet
          </button>
        )}
      </div>

      <section className="override" aria-label="Operator override">
        <h2>Operator Override</h2>
        <div className="override__fields">
          <label>
            Pod
            <select
              value={overridePod}
              onChange={(e) => setOverridePod(Number(e.target.value))}
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select
              value={overrideMode}
              onChange={(e) => setOverrideMode(e.target.value)}
            >
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="btn btn--danger" onClick={handleApplyOverride}>
          Apply Override
        </button>
      </section>

      <p className="console__modes">Modes: {MODES.join(' · ')}</p>
    </div>
  )
}
