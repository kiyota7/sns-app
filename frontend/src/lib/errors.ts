// catch節の変数はTypeScriptでは`unknown`型になるため、メッセージ取り出しを共通化する。
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
