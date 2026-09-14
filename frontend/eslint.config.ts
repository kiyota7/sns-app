import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

// 型チェックを伴わない `recommended` を採用している。frontend/e2e/tsconfig.json は
// ルートの tsconfig.json から意図的に参照していない(perf-tests/e2eのTypeScript化と
// 同じ考え方でビルドの型チェックに影響させないため)ため、型情報が必要な
// `recommendedTypeChecked` を使うと e2e/ 配下の解決に失敗するリスクがある。
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['dist/**', 'e2e/test-results/**', 'e2e/playwright-report/**', 'e2e/results/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended
)
