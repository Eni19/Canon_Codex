import { z } from 'zod'

/**
 * Preferências de um Codex (mundo v27): o que aparece na barra lateral e se as páginas com
 * interface interativa (caixa-arquivo, parede, bancada) usam a versão interativa ou a prática.
 * Ficam no documento do mundo, então valem em qualquer navegador e entram no backup.
 */

/** Ferramentas da barra lateral, na ordem em que aparecem. */
export const TOOL_IDS = ['calendar', 'relationships', 'boards', 'scenes', 'soundtrack'] as const
export type ToolId = (typeof TOOL_IDS)[number]

export const WorldPreferencesSchema = z.object({
  /** Tipos de conteúdo escondidos da barra lateral. */
  hiddenEntityTypes: z.array(z.string().min(1)).max(200),
  /** Ferramentas escondidas da barra lateral. */
  hiddenTools: z.array(z.enum(TOOL_IDS)).max(TOOL_IDS.length),
  /** Tipos que abrem na versão prática, sem a interface interativa. */
  plainInterfaces: z.array(z.string().min(1)).max(200),
})
export type WorldPreferences = z.infer<typeof WorldPreferencesSchema>

export const defaultWorldPreferences = (): WorldPreferences => ({ hiddenEntityTypes: [], hiddenTools: [], plainInterfaces: [] })

/**
 * Normaliza preferências antes de gravar: sem repetições, só ferramentas conhecidas e só tipos que
 * existem no mundo (tipos removidos saem da lista); interface prática só para tipos que têm a
 * interativa.
 */
export function normalizeWorldPreferences(input: WorldPreferences, entityTypeIds: string[]): WorldPreferences {
  const types = new Set(entityTypeIds)
  const unique = <T,>(values: T[]) => [...new Set(values)]
  return {
    hiddenEntityTypes: unique(input.hiddenEntityTypes).filter((id) => types.has(id)),
    hiddenTools: unique(input.hiddenTools).filter((id) => (TOOL_IDS as readonly string[]).includes(id)),
    plainInterfaces: unique(input.plainInterfaces).filter((id) => types.has(id) && hasInteractiveInterface(id)),
  }
}

/** Tipos que têm uma página interativa e uma prática. Tipos futuros entram aqui. */
export const INTERACTIVE_INTERFACES: Record<string, { interactive: string; plain: string }> = {
  organization: {
    interactive: 'Caixa-arquivo 3D: tire da caixa o dossiê, o livro de registro, a pasta dos subgrupos, o estatuto e a correspondência, e leia cada um de perto.',
    plain: 'Dossiê em página única, com quadro de pessoal, relatório, subgrupos, objetivos, ideais e relações à vista.',
  },
  evidence: {
    interactive: 'Parede de investigação 3D: polaroides, folhas datilografadas e notas presas por linha vermelha, que dá para rearrumar.',
    plain: 'Quadro de evidência em página única, com a imagem, as descobertas e o contexto organizados em seções.',
  },
  artifact: {
    interactive: 'Bancada de estudo 3D: a foto num tapete de corte, paquímetro para as dimensões, lupa para os detalhes, notas e relatório.',
    plain: 'Ficha de catalogação em página única, com a foto, os detalhes marcados e os campos do objeto.',
  },
}

export const hasInteractiveInterface = (typeId: string) => typeId in INTERACTIVE_INTERFACES

/** A página do tipo usa a interface interativa (o padrão) ou a prática. */
export const usesInteractiveInterface = (preferences: WorldPreferences, typeId: string) =>
  hasInteractiveInterface(typeId) && !preferences.plainInterfaces.includes(typeId)

/** Resumo de cada ferramenta e do que há nela, para a janela de configurações. */
export const TOOL_GUIDE: Record<ToolId, { label: string; summary: string; parts: string[] }> = {
  calendar: {
    label: 'Calendário',
    summary: 'O calendário próprio do mundo, usado por todas as datas e linhas do tempo.',
    parts: ['Meses, dias da semana e eras', 'Luas e fases', 'Estações e marcos', 'Data atual da campanha', 'Temas de aparência'],
  },
  relationships: {
    label: 'Relacionamentos',
    summary: 'O grafo das relações entre os registros, para ver quem se liga a quem.',
    parts: ['Registros como cartões e relações como ligações', 'Busca e filtros (ida, volta, tipo)', 'Cartões fixáveis e zoom'],
  },
  boards: {
    label: 'Quadros',
    summary: 'Quadros de investigação infinitos, com registros do mundo e anotações livres.',
    parts: ['Cartões de registros', 'Notas, textos e setas ligadas', 'Desenho livre, formas e imagens'],
  },
  scenes: {
    label: 'Cenas',
    summary: 'Cenas de jogo sobre o mapa de um local, para preparar, mestrar e projetar.',
    parts: ['Mapa de fundo e grade', 'Tokens de personagens, criaturas e objetos', 'Pontos de interesse e descobertas', 'Apresentação e projeção'],
  },
  soundtrack: {
    label: 'Trilha sonora',
    summary: 'Playlists para tocar durante as sessões.',
    parts: ['Playlists e faixas', 'Tocador na barra lateral', 'Música na projeção'],
  },
}

/** Resumo de cada tipo de conteúdo padrão; os campos vêm da própria definição do tipo. */
export const CONTENT_GUIDE: Record<string, string> = {
  character: 'Pessoas do mundo, com retrato, atributos e personalidade.',
  species: 'Espécies e povos: origem, regiões, idiomas, costumes e estrutura social.',
  location: 'Lugares, de reinos a cômodos, com planta, pontos marcados e região de cima.',
  organization: 'Grupos, guildas e instituições, com membros, liderança, subgrupos, objetivos e ideais.',
  case: 'Casos de investigação que reúnem pistas, evidências e envolvidos.',
  event: 'Acontecimentos com data, local e participantes, para a linha do tempo.',
  tale: 'Contos, lendas e relatos, escritos em capítulos.',
  document: 'Documentos do mundo: cartas, decretos, diários e registros escritos.',
  evidence: 'Provas de uma investigação, com descobertas, contexto e personagens ligados.',
  clue: 'Pistas soltas que ainda vão se ligar a algo.',
  creature: 'Criaturas e monstros, com imagem, natureza, classificação e habitat.',
  naturalScience: 'Plantas, minerais, doenças e remédios, com propriedades, usos e efeitos.',
  phenomenon: 'Fenômenos estranhos ou naturais e o que se sabe deles.',
  artifact: 'Objetos e artefatos, com foto, dimensões, origem, conservação e detalhes marcados.',
  concept: 'Ideias, sistemas e regras do mundo, explicados em blocos.',
  cosmology: 'Deuses, planos e forças cósmicas, com domínios e cultos.',
  timeline: 'Linhas do tempo que reúnem eventos e registros datados.',
}
