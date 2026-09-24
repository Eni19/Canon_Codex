import 'server-only'
import { ASSET_SCHEMA_VERSION } from '@/domain/assets/asset'
import { CONTENT_SCHEMA_VERSION } from '@/domain/content/contentDocument'
import { ENTITY_SCHEMA_VERSION } from '@/domain/entities/entity'
import { WORLD_SCHEMA_VERSION } from '@/domain/worlds/world'
import { EntityTypeDefinitionSchema } from '@/domain/entities/entityType'
import { ConceptBlocksSchema } from '@/domain/entities/conceptBlock'
import { createDefaultCalendar } from '@/domain/worlds/calendar'
import type { MigrationRegistry } from '@/lib/migrations/registry'

export const worldMigrations: MigrationRegistry = {
  currentVersion: WORLD_SCHEMA_VERSION,
  migrations: {
    1: (data) => ({
      ...data,
      schemaVersion: 2,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) =>
        type.id === 'character' && !type.properties.some((property) => property.key === 'profile')
          ? { ...type, properties: [{ key: 'profile', label: 'Perfil', kind: 'text' }, ...type.properties] }
          : type,
      ),
    }),
    2: (data) => ({
      ...data,
      schemaVersion: 3,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) =>
        type.id === 'character' && !type.properties.some((property) => property.key === 'personality')
          ? { ...type, properties: [...type.properties, { key: 'personality', label: 'Personalidade', kind: 'text' }] }
          : type,
      ),
    }),
    3: (data) => ({
      ...data,
      schemaVersion: 4,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'character') return type
        const properties = type.properties.map((property) =>
          property.key === 'personality' ? { ...property, kind: 'textarea' as const } : property,
        )
        return properties.some((property) => property.key === 'currentLocation')
          ? { ...type, properties }
          : { ...type, properties: [...properties, { key: 'currentLocation', label: 'Local atual', kind: 'reference', refType: 'location' }] }
      }),
    }),
    4: (data) => ({
      ...data,
      schemaVersion: 5,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id === 'document' || type.id === 'clue') return { ...type, showInSidebar: false }
        if (type.id !== 'evidence') return type
        const additions = [
          { key: 'evidenceFormat', label: 'Formato', kind: 'enum' as const, options: ['Evidência', 'Pista', 'Documento'] },
          { key: 'presentation', label: 'Apresentação', kind: 'textarea' as const },
          { key: 'contextualDescription', label: 'Notas contextuais', kind: 'textarea' as const },
          { key: 'relatedCharacters', label: 'Personagens relacionados', kind: 'referenceList' as const, refType: 'character' },
        ]
        return { ...type, properties: [...type.properties, ...additions.filter((addition) => !type.properties.some((property) => property.key === addition.key))] }
      }),
    }),
    5: (data) => ({
      ...data,
      schemaVersion: 6,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'organization') return type
        const additions = [
          { key: 'leaders', label: 'Líderes', kind: 'referenceList' as const, refType: 'character' },
          { key: 'objectives', label: 'Objetivos', kind: 'textarea' as const },
          { key: 'ideals', label: 'Ideais', kind: 'textarea' as const },
        ]
        return { ...type, properties: [...type.properties, ...additions.filter((addition) => !type.properties.some((property) => property.key === addition.key))] }
      }),
    }),
    6: (data) => ({
      ...data,
      schemaVersion: 7,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'creature') return type
        const additions = [
          { key: 'creatureKind', label: 'Natureza', kind: 'enum' as const, options: ['Monstro', 'Animal'] },
          { key: 'imagePresentation', label: 'Apresentação da imagem', kind: 'enum' as const, options: ['Contorno', 'Retrato'] },
        ]
        return { ...type, properties: [...additions.filter((addition) => !type.properties.some((property) => property.key === addition.key)), ...type.properties] }
      }),
    }),
    7: (data) => ({
      ...data,
      schemaVersion: 8,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id === 'case') return { ...type, showInSidebar: false }
        if (type.id === 'phenomenon') return { ...type, label: 'Fenômeno', pluralLabel: 'Fenômenos' }
        if (type.id === 'event') {
          const additions = [
            { key: 'eventStatus', label: 'Estado do evento', kind: 'enum' as const, options: ['Em andamento', 'Concluído', 'Arquivado', 'Não resolvido'] },
            { key: 'relatedLocations', label: 'Outros locais', kind: 'referenceList' as const, refType: 'location' },
          ]
          return { ...type, properties: [...additions.filter((addition) => !type.properties.some((property) => property.key === addition.key)), ...type.properties] }
        }
        if (type.id === 'evidence' || type.id === 'clue') {
          return { ...type, properties: type.properties.map((property) => property.key === 'relatedCase' ? { ...property, key: 'relatedEvent', label: 'Evento relacionado', refType: 'event' } : property) }
        }
        return type
      }),
    }),
    8: (data) => {
      const entityTypes = EntityTypeDefinitionSchema.array().parse(data.entityTypes)
      const additions = [
        {
          id: 'tale', label: 'Conto ou Lenda', pluralLabel: 'Contos e Lendas', icon: 'BookOpenText', color: 'muted' as const,
          layout: ['header', 'properties', 'content', 'relations', 'backlinks'] as const, showInSidebar: true,
          properties: [
            { key: 'taleType', label: 'Tipo de narrativa', kind: 'enum' as const, options: ['Conto', 'Lenda', 'Mito', 'Fábula', 'Relato oral'] },
            { key: 'culture', label: 'Cultura ou tradição', kind: 'text' as const },
            { key: 'period', label: 'Época narrada', kind: 'text' as const },
            { key: 'narrator', label: 'Narrador ou fonte', kind: 'text' as const },
          ],
        },
        {
          id: 'cosmology', label: 'Registro Cosmológico', pluralLabel: 'Cosmologia', icon: 'Orbit', color: 'accent' as const,
          layout: ['header', 'hero', 'properties', 'content', 'gallery', 'relations', 'backlinks'] as const, showInSidebar: true,
          properties: [
            { key: 'cosmologyType', label: 'Natureza', kind: 'enum' as const, options: ['Divindade', 'Entidade', 'Plano de existência', 'Reino', 'Corpo celeste', 'Outro'] },
            { key: 'domains', label: 'Domínios', kind: 'tags' as const },
            { key: 'pantheon', label: 'Panteão ou tradição', kind: 'text' as const },
            { key: 'worshipers', label: 'Cultos e organizações', kind: 'referenceList' as const, refType: 'organization' },
          ],
        },
      ]
      return { ...data, schemaVersion: 9, entityTypes: [...entityTypes, ...additions.filter((addition) => !entityTypes.some((type) => type.id === addition.id))] }
    },
    9: (data) => ({
      ...data,
      schemaVersion: 10,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'artifact') return type
        const additions = [
          { key: 'registrationNumber', label: 'Número de registro', kind: 'text' as const },
          { key: 'period', label: 'Época ou datação', kind: 'text' as const },
          { key: 'materials', label: 'Materiais', kind: 'tags' as const },
          { key: 'dimensions', label: 'Dimensões', kind: 'text' as const },
          { key: 'condition', label: 'Estado de conservação', kind: 'enum' as const, options: ['Íntegro', 'Estável', 'Frágil', 'Danificado', 'Em restauração', 'Desconhecido'] },
          { key: 'acquisition', label: 'Forma de aquisição', kind: 'textarea' as const },
        ]
        const definitions = new Map([...additions, ...type.properties].map((property) => [property.key, property]))
        const order = ['registrationNumber', 'artifactType', 'origin', 'period', 'materials', 'dimensions', 'condition', 'acquisition', 'currentLocation', 'owner']
        const ordered = [
          ...order.flatMap((key) => definitions.has(key) ? [definitions.get(key)!] : []),
          ...type.properties.filter((property) => !order.includes(property.key)),
        ]
        return { ...type, properties: ordered }
      }),
    }),
    10: (data) => ({
      ...data,
      schemaVersion: 11,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'cosmology') return type
        const additions = [
          { key: 'higherEntity', label: 'Entidade superior', kind: 'reference' as const, refType: 'cosmology' },
          { key: 'objectives', label: 'Objetivos', kind: 'textarea' as const },
          { key: 'ideals', label: 'Ideais', kind: 'textarea' as const },
          { key: 'associatedArtifacts', label: 'Artefatos associados', kind: 'referenceList' as const, refType: 'artifact' },
        ]
        const definitions = new Map([...additions, ...type.properties].map((property) => [property.key, property]))
        const order = ['cosmologyType', 'domains', 'higherEntity', 'pantheon', 'objectives', 'ideals', 'worshipers', 'associatedArtifacts']
        return {
          ...type,
          properties: [
            ...order.flatMap((key) => definitions.has(key) ? [definitions.get(key)!] : []),
            ...type.properties.filter((property) => !order.includes(property.key)),
          ],
        }
      }),
    }),
    11: (data) => ({
      ...data,
      schemaVersion: 12,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'tale') return type
        const knownKeys = new Set(['subtitle', 'taleType', 'period', 'setting', 'characters', 'culture', 'narrator', 'openingLayout', 'notes'])
        return {
          ...type,
          label: 'Conto',
          pluralLabel: 'Contos',
          properties: [
            { key: 'subtitle', label: 'Subtítulo', kind: 'text' as const },
            { key: 'taleType', label: 'Tipo', kind: 'enum' as const, options: ['Conto', 'Crônica', 'Novela', 'Romance', 'Lenda', 'Mito', 'Fábula', 'Relato oral'] },
            { key: 'period', label: 'Período', kind: 'text' as const },
            { key: 'setting', label: 'Local', kind: 'reference' as const, refType: 'location' },
            { key: 'characters', label: 'Personagens', kind: 'referenceList' as const, refType: 'character' },
            { key: 'culture', label: 'Cultura ou tradição', kind: 'text' as const },
            { key: 'narrator', label: 'Narrador ou fonte', kind: 'text' as const },
            { key: 'openingLayout', label: 'Layout de abertura', kind: 'enum' as const, options: ['Panorâmico', 'Centralizado', 'Editorial'] },
            { key: 'notes', label: 'Notas opcionais', kind: 'textarea' as const },
            ...type.properties.filter((property) => !knownKeys.has(property.key)),
          ],
        }
      }),
    }),
    12: (data) => ({
      ...data,
      schemaVersion: 13,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'concept') return type
        const knownKeys = new Set(['category', 'summary', 'notation', 'paperStyle'])
        return {
          ...type,
          properties: [
            type.properties.find((property) => property.key === 'category') ?? { key: 'category', label: 'Categoria', kind: 'text' as const },
            { key: 'summary', label: 'Subtítulo ou resumo', kind: 'textarea' as const },
            ...type.properties.filter((property) => !knownKeys.has(property.key)),
          ],
        }
      }),
    }),
    13: (data) => ({
      ...data,
      schemaVersion: 14,
      entityTypes: EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => {
        if (type.id !== 'concept') return type
        const category = type.properties.find((property) => property.key === 'category') ?? { key: 'category', label: 'Categoria', kind: 'text' as const }
        const summary = { key: 'summary', label: 'Subtítulo ou resumo', kind: 'textarea' as const }
        return { ...type, properties: [category, summary, ...type.properties.filter((property) => !['category', 'summary', 'notation', 'paperStyle'].includes(property.key))] }
      }),
    }),
    14: (data) => {
      const entityTypes = EntityTypeDefinitionSchema.array().parse(data.entityTypes).map((type) => type.id === 'phenomenon' ? { ...type, showInSidebar: false } : type)
      const additions = [
        {
          id: 'species', label: 'Espécie / Povo', pluralLabel: 'Espécies / Povos', icon: 'Dna', color: 'accent' as const,
          layout: ['header', 'hero', 'properties', 'content', 'gallery', 'relations', 'backlinks'] as const, showInSidebar: true,
          properties: [
            { key: 'recordKind', label: 'Tipo de registro', kind: 'enum' as const, options: ['Espécie', 'Povo / Cultura'] },
            { key: 'classification', label: 'Classificação', kind: 'text' as const },
            { key: 'relatedSpecies', label: 'Espécies associadas', kind: 'referenceList' as const, refType: 'species' },
            { key: 'originLocation', label: 'Origem', kind: 'reference' as const, refType: 'location' },
            { key: 'habitats', label: 'Regiões habitadas', kind: 'referenceList' as const, refType: 'location' },
            { key: 'languages', label: 'Idiomas', kind: 'tags' as const },
            { key: 'traits', label: 'Características', kind: 'tags' as const },
            { key: 'lifespan', label: 'Expectativa de vida', kind: 'text' as const },
            { key: 'population', label: 'População', kind: 'text' as const },
            { key: 'socialStructure', label: 'Estrutura social', kind: 'textarea' as const },
            { key: 'customs', label: 'Costumes e tradições', kind: 'textarea' as const },
            { key: 'relatedOrganizations', label: 'Organizações relacionadas', kind: 'referenceList' as const, refType: 'organization' },
          ],
        },
        {
          id: 'naturalScience', label: 'Natureza / Medicina', pluralLabel: 'Natureza / Medicina', icon: 'Microscope', color: 'accent' as const,
          layout: ['header', 'hero', 'properties', 'content', 'gallery', 'relations', 'backlinks'] as const, showInSidebar: true,
          properties: [
            { key: 'discipline', label: 'Área', kind: 'enum' as const, options: ['Natureza', 'Medicina'] },
            { key: 'scienceSubtype', label: 'Subtipo', kind: 'enum' as const, options: ['Flora', 'Fauna', 'Fungo', 'Mineral', 'Ecossistema', 'Recurso natural', 'Doença', 'Condição', 'Ferimento', 'Substância', 'Medicamento', 'Veneno', 'Tratamento', 'Anatomia'] },
            { key: 'scientificName', label: 'Nome técnico ou científico', kind: 'text' as const },
            { key: 'habitat', label: 'Habitat ou ocorrência', kind: 'reference' as const, refType: 'location' },
            { key: 'distribution', label: 'Distribuição', kind: 'referenceList' as const, refType: 'location' },
            { key: 'notableProperties', label: 'Propriedades', kind: 'tags' as const },
            { key: 'toxicity', label: 'Toxicidade', kind: 'enum' as const, options: ['Nenhuma', 'Baixa', 'Moderada', 'Alta', 'Letal', 'Desconhecida'] },
            { key: 'affectedSystem', label: 'Sistema afetado', kind: 'text' as const },
            { key: 'transmission', label: 'Transmissão', kind: 'text' as const },
            { key: 'symptoms', label: 'Sintomas', kind: 'tags' as const },
            { key: 'progression', label: 'Progressão', kind: 'text' as const },
            { key: 'uses', label: 'Usos e aplicações', kind: 'textarea' as const },
            { key: 'treatment', label: 'Tratamento ou manejo', kind: 'textarea' as const },
            { key: 'relatedEntries', label: 'Registros relacionados', kind: 'referenceList' as const, refType: 'naturalScience' },
          ],
        },
      ]
      return { ...data, schemaVersion: 15, entityTypes: [...entityTypes, ...additions.filter((addition) => !entityTypes.some((type) => type.id === addition.id))] }
    },
    15: (data) => ({
      ...data,
      schemaVersion: 16,
      calendar: data.calendar ?? createDefaultCalendar(),
    }),
  },
}
export const entityMigrations: MigrationRegistry = {
  currentVersion: ENTITY_SCHEMA_VERSION,
  migrations: {
    1: (data) => ({ ...data, schemaVersion: 2 }),
    2: (data) => {
      const properties = data.properties && typeof data.properties === 'object' ? { ...data.properties } as Record<string, unknown> : {}
      if (data.type === 'case') {
        const { caseStatus, openedDate, involved, ...remaining } = properties
        const statusMap: Record<string, string> = { Aberto: 'Em andamento', Fechado: 'Concluído', Arquivado: 'Arquivado', 'Não resolvido': 'Não resolvido' }
        const eventStatus = typeof caseStatus === 'string' ? statusMap[caseStatus] ?? caseStatus : caseStatus
        return { ...data, type: 'event', properties: { ...remaining, eventStatus, eventDate: openedDate, participants: involved }, schemaVersion: 3 }
      }
      if ((data.type === 'evidence' || data.type === 'clue') && properties.relatedCase !== undefined) {
        const { relatedCase, ...remaining } = properties
        return { ...data, properties: { ...remaining, relatedEvent: relatedCase }, schemaVersion: 3 }
      }
      return { ...data, schemaVersion: 3 }
    },
    3: (data) => {
      const properties = data.properties && typeof data.properties === 'object' ? { ...data.properties } as Record<string, unknown> : {}
      if (data.type !== 'concept' || !Array.isArray(properties.conceptBlocks)) return { ...data, schemaVersion: 4 }
      const typeMap: Record<string, string> = {
        definition: 'overview',
        note: 'notes',
        rule: 'rules',
        example: 'examples',
        terms: 'terminology',
        formula: 'diagram',
        sketch: 'diagram',
        question: 'notes',
      }
      const converted = properties.conceptBlocks.map((value) => {
        if (!value || typeof value !== 'object') return value
        const block = value as Record<string, unknown>
        const type = typeof block.type === 'string' ? typeMap[block.type] ?? block.type : block.type
        return { ...block, type }
      })
      return { ...data, properties: { ...properties, conceptBlocks: ConceptBlocksSchema.parse(converted) }, schemaVersion: 4 }
    },
  },
}
export const contentMigrations: MigrationRegistry = {
  currentVersion: CONTENT_SCHEMA_VERSION,
  migrations: {
    1: (data) => ({
      ...data,
      schemaVersion: 2,
      pages: [{ id: 'principal', title: 'Principal', body: data.body }],
      body: undefined,
    }),
  },
}
export const assetMigrations: MigrationRegistry = { currentVersion: ASSET_SCHEMA_VERSION, migrations: {} }
