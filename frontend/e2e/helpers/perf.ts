// ブラウザパフォーマンス計測ユーティリティ。
//
// 位置づけは「計測・記録のみ」。perf-tests(k6)と同じ考え方で、CIのような
// 安定した実行環境が無い開発者個人のローカルマシンでは、厳密な失敗しきい値を
// 設けても値の根拠が主観的になりやすい。ここでは expect().toBeLessThan() の
// ような合否判定は一切行わず、実行のたびにJSONで記録し、人間が前後の値を
// 比較できるようにすることだけを目的とする。
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import type { Page } from '@playwright/test'

const RESULTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results')

export interface NavigationTimingSample {
  label: string
  ttfbMs: number
  domInteractiveMs: number
  domContentLoadedMs: number
  loadEventMs: number
}

export interface PaintTimingSample {
  label: string
  firstPaintMs: number | null
  firstContentfulPaintMs: number | null
}

export interface InteractionTimingSample {
  label: string
  durationMs: number
}

export interface PerfReport {
  generatedAt: string
  navigation: NavigationTimingSample[]
  paint: PaintTimingSample[]
  interactions: InteractionTimingSample[]
}

// Navigation Timing Level 2 (performance.getEntriesByType('navigation'))。
// pageの直近のナビゲーション(page.gotoやreload)に対して呼ぶこと。
export async function captureNavigationTiming(page: Page, label: string): Promise<NavigationTimingSample> {
  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (!nav) return null
    return {
      startTime: nav.startTime,
      responseStart: nav.responseStart,
      domInteractive: nav.domInteractive,
      domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
      loadEventEnd: nav.loadEventEnd,
    }
  })
  if (!timing) {
    throw new Error(`[e2e/perf] "${label}": performance navigation entry not found`)
  }
  return {
    label,
    ttfbMs: round(timing.responseStart - timing.startTime),
    domInteractiveMs: round(timing.domInteractive - timing.startTime),
    domContentLoadedMs: round(timing.domContentLoadedEventEnd - timing.startTime),
    loadEventMs: round(timing.loadEventEnd - timing.startTime),
  }
}

// Paint Timing (first-paint / first-contentful-paint)。
// page.goto() の直後は、first-contentful-paint のエントリがまだ
// PerformanceObserverに記録されていないことがある(ナビゲーション完了と
// ペイントの記録は非同期)。短時間だけ出現を待ってから読み取る
// (それでも記録されない場合はnullのまま返す。record-onlyの方針上、
// 無理に値を作らず「取れなかった」ことをそのまま示す)。
export async function capturePaintTiming(page: Page, label: string): Promise<PaintTimingSample> {
  await page
    .waitForFunction(() => performance.getEntriesByType('paint').some((e) => e.name === 'first-contentful-paint'), {
      timeout: 1_000,
    })
    .catch(() => {})

  const entries = await page.evaluate(() =>
    performance.getEntriesByType('paint').map((e) => ({ name: e.name, startTime: e.startTime }))
  )
  const firstPaint = entries.find((e) => e.name === 'first-paint')?.startTime
  const firstContentfulPaint = entries.find((e) => e.name === 'first-contentful-paint')?.startTime
  return {
    label,
    firstPaintMs: firstPaint !== undefined ? round(firstPaint) : null,
    firstContentfulPaintMs: firstContentfulPaint !== undefined ? round(firstContentfulPaint) : null,
  }
}

// 任意の操作(Playwright API呼び出しの一連)にかかった実時間を計測する。
// ブラウザ内の単一 performance.now() では計測できない、Node側から見た
// 「クリックしてから、期待するDOM変化が起きるまで」のような操作単位の
// 所要時間を測るためのもの。
export async function timeInteraction(label: string, fn: () => Promise<void>): Promise<InteractionTimingSample> {
  const start = Date.now()
  await fn()
  return { label, durationMs: Date.now() - start }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100
}

// 実行結果を e2e/results/run-<timestamp>.json に書き出し、あわせて
// コンソールに一覧表を出す。ファイルは gitignore対象(perf-tests/results/と
// 同じ考え方)で、developerが前回実行分と手元で見比べるためのもの。
export function writeRunReport(report: Omit<PerfReport, 'generatedAt'>): string {
  const generatedAt = new Date().toISOString()
  const full: PerfReport = { generatedAt, ...report }

  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const filePath = path.join(RESULTS_DIR, `run-${generatedAt.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2))

  console.log(`\n[e2e/performance] 計測結果を書き出しました: ${filePath}\n`)
  if (full.navigation.length > 0) {
    console.log('--- Navigation / Paint Timing (ms) ---')
    console.table(
      full.navigation.map((n) => {
        const paint = full.paint.find((p) => p.label === n.label)
        return {
          label: n.label,
          TTFB: n.ttfbMs,
          domInteractive: n.domInteractiveMs,
          domContentLoaded: n.domContentLoadedMs,
          loadEvent: n.loadEventMs,
          firstPaint: paint?.firstPaintMs ?? '-',
          firstContentfulPaint: paint?.firstContentfulPaintMs ?? '-',
        }
      })
    )
  }
  if (full.interactions.length > 0) {
    console.log('--- 操作単位の所要時間 (ms) ---')
    console.table(full.interactions.map((i) => ({ label: i.label, durationMs: i.durationMs })))
  }

  return filePath
}
