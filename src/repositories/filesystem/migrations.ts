import 'server-only'
import { ASSET_SCHEMA_VERSION } from '@/domain/assets/asset'
import { CONTENT_SCHEMA_VERSION } from '@/domain/content/contentDocument'
import { ENTITY_SCHEMA_VERSION } from '@/domain/entities/entity'
import { WORLD_SCHEMA_VERSION } from '@/domain/worlds/world'
import { EntityTypeDefinitionSchema } from '@/domain/entities/entityType'
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
