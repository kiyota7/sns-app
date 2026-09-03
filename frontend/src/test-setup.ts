import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdomはIntersectionObserverを実装していないため、TimelineViewの無限スクロールが
// マウント時にクラッシュしないよう、何もしないデフォルト実装を用意しておく。
// 実際の交差判定が必要なテストでは、各specファイル側で個別にモックし直す。
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver)
