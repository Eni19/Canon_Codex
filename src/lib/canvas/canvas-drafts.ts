/**
 * Última versão de um canvas (quadro ou cena) nesta aba.
 *
 * Ao sair de um quadro por navegação do cliente e voltar, o roteador do Next pode reaproveitar a
 * página carregada antes, com o canvas antigo. Guardar aqui cada alteração permite reabrir o
 * editor no estado mais novo. Recarregar a página limpa a memória e o servidor volta a ser a fonte.
 */
const drafts = new Map<string, unknown>()

export const canvasDraftKey = (kind: 'board' | 'scene', id: string) => `${kind}:${id}`
export const readCanvasDraft = <T,>(key: string): T | undefined => drafts.get(key) as T | undefined
export const writeCanvasDraft = (key: string, value: unknown) => { drafts.set(key, value) }

// Limite do navegador para corpos com `keepalive` (64 KiB), com folga.
const KEEPALIVE_LIMIT = 60_000

/**
 * Envia um salvamento que precisa terminar mesmo se a página estiver sendo deixada. Navegar dentro
 * do app não cancela um `fetch` comum; `keepalive` cobre o fechamento da aba quando o corpo cabe.
 */
export function sendCanvasSave(url: string, body: unknown) {
  const text = JSON.stringify(body)
  return fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: text, keepalive: text.length < KEEPALIVE_LIMIT })
}
