export const migrations = [
  `
  CREATE TABLE library_state (
    id INTEGER PRIMARY KEY CHECK (id = 1)
  ) STRICT;

  CREATE TABLE worlds (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL COLLATE NOCASE,
    document TEXT NOT NULL CHECK (json_valid(document)),
    deleted_at TEXT
  ) STRICT;
  CREATE UNIQUE INDEX active_world_slug ON worlds(slug) WHERE deleted_at IS NULL;

  CREATE TABLE entities (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    content TEXT CHECK (json_valid(content)),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    deleted_at TEXT,
    PRIMARY KEY (world_id, id)
  ) STRICT;
  CREATE INDEX active_entities ON entities(world_id, id) WHERE deleted_at IS NULL;
  CREATE INDEX active_entity_type ON entities(world_id, type, id) WHERE deleted_at IS NULL;

  CREATE TABLE relations (
    world_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    document TEXT NOT NULL CHECK (json_valid(document)),
    PRIMARY KEY (world_id, source_id, id),
    FOREIGN KEY (world_id, source_id) REFERENCES entities(world_id, id)
  ) STRICT;
  CREATE INDEX relation_target ON relations(world_id, target_id, source_id);

  CREATE TABLE timelines (
    world_id TEXT NOT NULL,
    id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (world_id, id),
    FOREIGN KEY (world_id, id) REFERENCES entities(world_id, id)
  ) STRICT;

  CREATE TABLE timeline_appearances (
    world_id TEXT NOT NULL,
    timeline_id TEXT NOT NULL,
    id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    document TEXT NOT NULL CHECK (json_valid(document)),
    PRIMARY KEY (world_id, timeline_id, id),
    UNIQUE (world_id, timeline_id, position),
    FOREIGN KEY (world_id, timeline_id) REFERENCES timelines(world_id, id)
  ) STRICT;
  CREATE INDEX appearance_target ON timeline_appearances(world_id, entity_id);

  CREATE TABLE assets (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    id TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    deleted_at TEXT,
    PRIMARY KEY (world_id, id)
  ) STRICT;

  CREATE TABLE asset_variants (
    world_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    variant TEXT NOT NULL CHECK (variant IN ('original', 'thumbnail', 'calendar-mobile', 'calendar-desktop')),
    mime_type TEXT NOT NULL,
    bytes BLOB NOT NULL,
    PRIMARY KEY (world_id, asset_id, variant),
    FOREIGN KEY (world_id, asset_id) REFERENCES assets(world_id, id)
  ) STRICT;

  CREATE TABLE boards (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    id TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    deleted_at TEXT,
    PRIMARY KEY (world_id, id)
  ) STRICT;

  CREATE TABLE scenes (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    id TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    deleted_at TEXT,
    PRIMARY KEY (world_id, id)
  ) STRICT;

  CREATE TABLE playlists (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    id TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    deleted_at TEXT,
    PRIMARY KEY (world_id, id)
  ) STRICT;

  CREATE TABLE histories (
    world_id TEXT NOT NULL REFERENCES worlds(id),
    kind TEXT NOT NULL CHECK (kind IN ('date', 'origin')),
    id TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    PRIMARY KEY (world_id, kind, id)
  ) STRICT;
  `,
  `
  CREATE TABLE graph_settings (
    world_id TEXT PRIMARY KEY REFERENCES worlds(id),
    document TEXT NOT NULL CHECK (json_valid(document))
  ) STRICT;
  `,
  // Mundo v25: o tipo artifact passa a "Objeto" / "Objetos" quando ainda tem o nome padrão antigo
  // (mesma regra de renameObjectType); nomes personalizados ficam como estão.
  `
  UPDATE worlds SET document = (
    SELECT json_set(worlds.document, '$.entityTypes[' || item.key || '].label', 'Objeto')
    FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact' AND json_extract(item.value, '$.label') = 'Objeto / Artefato'
  )
  WHERE EXISTS (
    SELECT 1 FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact' AND json_extract(item.value, '$.label') = 'Objeto / Artefato'
  );
  UPDATE worlds SET document = (
    SELECT json_set(worlds.document, '$.entityTypes[' || item.key || '].pluralLabel', 'Objetos')
    FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact' AND json_extract(item.value, '$.pluralLabel') = 'Objetos / Artefatos'
  )
  WHERE EXISTS (
    SELECT 1 FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact' AND json_extract(item.value, '$.pluralLabel') = 'Objetos / Artefatos'
  );
  UPDATE worlds SET document = json_set(document, '$.schemaVersion', 25) WHERE json_extract(document, '$.schemaVersion') = 24;
  `,
  // Mundo v26: a ficha de Objeto perde número de registro e materiais (mesma regra de
  // removeObjectFields); valores já preenchidos ficam nos registros.
  `
  UPDATE worlds SET document = (
    SELECT json_set(worlds.document, '$.entityTypes[' || item.key || '].properties', (
      SELECT json_group_array(json(field.value)) FROM json_each(item.value, '$.properties') AS field
      WHERE json_extract(field.value, '$.key') NOT IN ('registrationNumber', 'materials')
    ))
    FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact'
  )
  WHERE EXISTS (
    SELECT 1 FROM json_each(worlds.document, '$.entityTypes') AS item
    WHERE json_extract(item.value, '$.id') = 'artifact'
  );
  UPDATE worlds SET document = json_set(document, '$.schemaVersion', 26) WHERE json_extract(document, '$.schemaVersion') = 25;
  `,
  // Mundo v27: preferências do Codex (barra lateral e interfaces), começando com tudo visível e
  // interativo (mesmo padrão de defaultWorldPreferences).
  `
  UPDATE worlds SET document = json_set(document, '$.preferences', json('{"hiddenEntityTypes":[],"hiddenTools":[],"plainInterfaces":[],"contentOrder":[]}'))
  WHERE json_type(document, '$.preferences') IS NULL;
  UPDATE worlds SET document = json_set(document, '$.schemaVersion', 27) WHERE json_extract(document, '$.schemaVersion') = 26;
  `,
]
