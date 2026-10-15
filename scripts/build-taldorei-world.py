"""Build a local Canon Codex import folder from the user's Tal'Dorei PDF.

Usage: python scripts/build-taldorei-world.py PDF_PATH
The generated pack is intentionally kept outside workspace/.
"""

from __future__ import annotations

import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'world-packs' / 'taldorei-renascido-completo'
WORLD_ID = uuid.UUID('3c421d4a-a1f0-4da8-a047-184617200836')
STAMP = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

# Printed book pages. The PDF cover adds one page to these numbers.
REGIONS = [
    ('Costa Lucidiana', 66, 71),
    ('Serras de Alabastro', 72, 79),
    ('Planícies Divididas', 80, 92),
    ('Cordilheira Escarpalta', 93, 107),
    ('Montanhas Tempestuosas', 108, 111),
    ('Península Brumadensa', 112, 119),
    ('Vastidão Verdejante', 120, 127),
    ('Litoral Brilhespada', 128, 144),
    ('Outras Terras de Exandria', 145, 148),
    ('Issylra', 145, 145), ('Marquet', 145, 146),
    ('Os Dentes Partidos', 146, 146), ('Wildemount', 146, 147),
]

SETTLEMENTS = [
    ('Drynna', 66, 'Costa Lucidiana'), ('Stilben', 68, 'Costa Lucidiana'),
    ('Zephrah', 71, 'Costa Lucidiana'), ('Pedra-Alva', 75, 'Serras de Alabastro'),
    ('Kymal', 83, 'Planícies Divididas'), ('Campos Turst', 88, 'Planícies Divididas'),
    ('Trilhoeste', 89, 'Planícies Divididas'), ('Vila Jorenn', 96, 'Cordilheira Escarpalta'),
    ('Martelo-do-Rochedo', 96, 'Cordilheira Escarpalta'), ('Cinzaforte', 100, 'Cordilheira Escarpalta'),
    ('Lyrengorn', 102, 'Cordilheira Escarpalta'), ('Escarpa Extensa', 105, 'Cordilheira Escarpalta'),
    ('Terrah', 106, 'Cordilheira Escarpalta'), ('Fontecharco', 110, 'Montanhas Tempestuosas'),
    ('Ruhn-Shak', 111, 'Montanhas Tempestuosas'), ('Byroden', 114, 'Península Brumadensa'),
    ('Niirdal-Poc', 115, 'Península Brumadensa'), ('Tz’Arrm', 119, 'Península Brumadensa'),
    ('Syngorn', 123, 'Vastidão Verdejante'), ('Águas de Vues’dal', 128, 'Litoral Brilhespada'),
    ('Entreposto Esmeralda', 130, 'Litoral Brilhespada'), ('Emon', 130, 'Litoral Brilhespada'),
    ('Nova O’Noa', 143, 'Litoral Brilhespada'), ('Passo D’água', 144, 'Litoral Brilhespada'),
    ('Vasselheim', 145, 'Issylra'), ('Shamal', 145, 'Marquet'),
    ('Ank’Harel', 145, 'Marquet'), ('Ruukva', 146, 'Os Dentes Partidos'),
]

FACTIONS = [
    ('Conselho de Tal’Dorei', 42, 45), ('Arcana Pansófica', 46, 47),
    ('Os Ashari', 48, 49), ('Liga dos Lutadores', 50, 50),
    ('Câmara de Pedra-Alva', 50, 51), ('Ordens Claretes', 52, 52),
    ('A Fivela', 53, 53), ('Sorriso Dourado', 54, 54),
    ('Casas de Martelo-do-Rochedo', 55, 55), ('Liga dos Milagres', 56, 57),
    ('Biblioteca da Alma de Cobalto', 58, 59), ('A Miríade', 60, 60),
    ('Os Remanescentes', 61, 62), ('Guardiões de Syngorn', 63, 64),
    ('Reunião do Rebanho', 87, 88), ('Devastadores', 88, 88),
    ('Autoridade de Ferro', 119, 120), ('Guarda Verdejante', 123, 123),
    ('Aliança da Criação Élfica', 127, 127), ('Mãos de Ord', 145, 146),
    ('União Ossended', 146, 146), ('Assembleia dos Andarilhos', 146, 146),
    ('Tratado Clovis', 146, 146), ('Império Dwendaliano', 146, 147),
    ('Assembleia Cerberus', 146, 146), ('Dinastia Kryn', 147, 147),
    ('Vox Machina', 260, 278),
]

# These entries have their own Gazetteer treatment but no settlement population line.
SITES = [
    ('Pântano K’Tawl', 67, 'Costa Lucidiana'), ('Falésias do Sal', 73, 'Serras de Alabastro'),
    ('Bacia Foramira', 81, 'Planícies Divididas'), ('Cume do Trono de Ferro', 82, 'Planícies Divididas'),
    ('Matagal da Hera-Coração', 83, 'Planícies Divididas'), ('Estrada do Corte Prata', 87, 'Planícies Divididas'),
    ('Forte Daxio', 94, 'Cordilheira Escarpalta'), ('Palácio das Maravilhas', 104, 'Cordilheira Escarpalta'),
    ('Pântanos Verte-Sonho', 110, 'Montanhas Tempestuosas'), ('Niirdal-Sarqet', 117, 'Península Brumadensa'),
    ('Forte Deslocável', 123, 'Vastidão Verdejante'), ('Cataratas Tormor', 128, 'Litoral Brilhespada'),
    ('Baía da Adaga', 129, 'Litoral Brilhespada'), ('Ilha Visa', 145, 'Outras Terras de Exandria'),
]

PEOPLES = [
    ('Sangue de Dragão', 151, 152), ('Anões', 152, 153), ('Ancestralidade Elemental', 154, 154),
    ('Elfos', 154, 155), ('Firbolgs', 156, 156), ('Gnomos', 157, 157),
    ('Povo Goblin', 158, 159), ('Meio-Gigantes', 159, 159), ('Pequeninos', 160, 161),
    ('Humanos', 161, 161), ('Orcs', 162, 163), ('Tiferinos', 163, 163),
    ('Ancestralidade Mista', 163, 164), ('Outras Raças', 164, 164),
]

DEITIES = [
    ('Comutadora', 28, 'Divindades Primevas'), ('Dragão de Platina', 28, 'Divindades Primevas'),
    ('Arco-Coração', 29, 'Divindades Primevas'), ('Porta-Lei', 29, 'Divindades Primevas'),
    ('Mentora Sábia', 30, 'Divindades Primevas'), ('Lorde da Tempestade', 30, 'Divindades Primevas'),
    ('Mãe Selvagem', 31, 'Divindades Primevas'), ('Onimartelo', 31, 'Divindades Primevas'),
    ('Pai do Alvorecer', 32, 'Divindades Primevas'), ('Luz Eterna', 32, 'Divindades Primevas'),
    ('Matrona dos Corvos', 33, 'Divindades Primevas'), ('Tecelã da Lua', 33, 'Divindades Primevas'),
    ('Lorde dos Infernos', 34, 'Deuses Traidores'), ('Imperador da Contenda', 35, 'Deuses Traidores'),
    ('Arruinador', 35, 'Deuses Traidores'), ('Rainha Aranha', 36, 'Deuses Traidores'),
    ('Oblívio Acorrentado', 36, 'Deuses Traidores'), ('Tirana Escamada', 37, 'Deuses Traidores'),
    ('Rei Rastejante', 37, 'Deuses Traidores'), ('O Sussurrado', 38, 'Deuses Traidores'),
    ('Serpente Encoberta', 38, 'Deuses Traidores'), ('Azgrah', 40, 'Ídolos Menores'),
    ('O Sinal Perdido da Luz Desconhecida', 41, 'Ídolos Menores'), ('O Viajante', 42, 'Ídolos Menores'),
]

# Divine domains printed on pages 28–38. Lesser idols have no divine-domain list in the book.
DEITY_DOMAINS = {
    'Comutadora': ['Lua', 'Natureza', 'Trapaça'],
    'Dragão de Platina': ['Vida', 'Ordem', 'Guerra'],
    'Arco-Coração': ['Arcano', 'Natureza', 'Luz'],
    'Porta-Lei': ['Conhecimento', 'Ordem'],
    'Mentora Sábia': ['Arcano', 'Conhecimento', 'Crepúsculo'],
    'Lorde da Tempestade': ['Tempestade', 'Guerra'],
    'Mãe Selvagem': ['Vida', 'Natureza', 'Tempestade'],
    'Onimartelo': ['Forja', 'Conhecimento', 'Guerra'],
    'Pai do Alvorecer': ['Vida', 'Luz', 'Natureza'],
    'Luz Eterna': ['Vida', 'Luz', 'Paz'],
    'Matrona dos Corvos': ['Morte', 'Túmulo', 'Crepúsculo'],
    'Tecelã da Lua': ['Arcanismo', 'Lua', 'Crepúsculo'],
    'Lorde dos Infernos': ['Ordem', 'Trapaça', 'Guerra'],
    'Imperador da Contenda': ['Forja', 'Ordem', 'Guerra'],
    'Arruinador': ['Morte', 'Tempestade', 'Guerra'],
    'Rainha Aranha': ['Conhecimento', 'Trapaça'],
    'Oblívio Acorrentado': ['Morte', 'Túmulo', 'Trapaça'],
    'Tirana Escamada': ['Ordem', 'Trapaça', 'Guerra'],
    'Rei Rastejante': ['Morte', 'Trapaça'],
    'O Sussurrado': ['Arcanismo', 'Morte', 'Conhecimento'],
    'Serpente Encoberta': ['Natureza', 'Trapaça'],
}

DEITY_HEADINGS = {
    'Arco-Coração': 'Os Arco-Coração',
    'Mãe Selvagem': 'A Mãe Selv agem',
    'O Sussurrado': 'O Sussurrado',
    'Arruinador': 'O Arruinador',
    'Azgrah': 'Azgrah, Lorde da Morada Profunda',
}

COSMOS = [
    ('Catha', 9, 'Corpo celeste'), ('Ruidus', 9, 'Corpo celeste'),
    ('Plano Material', 10, 'Plano de existência'), ('Planos Elementais', 10, 'Plano de existência'),
    ('Reino Feérico', 10, 'Plano de existência'), ('Plano das Sombras', 10, 'Plano de existência'),
    ('Plano Etéreo', 10, 'Plano de existência'), ('Plano Astral', 10, 'Plano de existência'),
    ('Planos Exteriores', 11, 'Plano de existência'), ('Reinos Além', 11, 'Plano de existência'),
]

CHARACTERS = [
    ('Uriel Tal’Dorei II', 42, 43, None, 'Conselho de Tal’Dorei'),
    ('Zan Tal’Dorei', 20, 21, None, None),
    ('Allura Vysoren', 47, 48, 'Emon', 'Arcana Pansófica'),
    ('Percival de Rolo', 52, 52, 'Pedra-Alva', 'Câmara de Pedra-Alva'),
    ('Grog Strongjaw', 261, 264, 'Trilhoeste', 'Vox Machina'),
    ('Keyleth', 264, 266, 'Zephrah', 'Os Ashari'),
    ('Vex’ahlia de Rolo', 266, 270, 'Pedra-Alva', 'Vox Machina'),
    ('Pike Trickfoot', 270, 272, 'Trilhoeste', 'Vox Machina'),
    ('Scanlan Shorthalt', 272, 274, None, 'Vox Machina'),
    ('Taryon Darrington', 274, 276, None, 'Vox Machina'),
    ('Vax’ildan', 276, 278, None, 'Vox Machina'),
]

ARTIFACTS = [
    ('Botas de Vigilante', 195), ('Agonia', 202), ('Beijo da Comutadora', 203),
    ('Condenadora', 204), ('Fenthras', 206), ('Lâmina Estelar', 207),
    ('Malho-Ardente', 208), ('Manoplas de Pedra Titânica', 209),
    ('Ramo da Confluência', 210), ('Ruína da Cabala', 211), ('Sussurro', 212),
]

CREATURES = [
    ('Adranauta', 223), ('Aranha Demoníaca', 227), ('Árvore-Fantasma', 228),
    ('Ciclope Tormentório', 235), ('Elemental Jorra-Cinzas', 238),
    ('Espírito de Fragmento Frio', 239), ('Esqueleto Centauro', 240),
    ('Golem Caça-Magos', 243), ('Golem de Cobalto', 244), ('Golem de Platina', 245),
    ('Guardião da Forja', 246), ('Jourrael, a Caedogeist', 249),
    ('Roca das Brasas', 255), ('Serpentinos Vos’skyriss', 256),
    ('Tubarão da Terra de Magma', 258), ('Vaca das Planícies', 259),
]

EVENTS = [
    ('A Fundação', 13, 14, -5000, None),
    ('A Cisma', 14, 15, -4000, None),
    ('Era do Arcanum', 15, 16, -1200, None),
    ('A Calamidade', 16, 17, -100, None),
    ('A Divergência', 16, 17, 0, None),
    ('Ascensão de Zan Tal’Dorei', 20, 21, 510, 'Emon'),
    ('Guerra Dispersa', 19, 21, 500, 'Emon'),
    ('Conclave Croma em Emon', 21, 24, 810, 'Emon'),
    ('Fim da monarquia de Tal’Dorei', 42, 43, 810, 'Emon'),
    ('Ascensão e derrota d’O Sussurrado', 22, 24, 812, 'Emon'),
    ('Tal’Dorei em 836 P.D.', 8, 9, 836, None),
    ('Despertar dos serpentinos Vos’skyriss', 145, 145, 836, 'Ilha Visa'),
]

ESTIMATED_EVENT_YEARS = {title for title, _, _, _, _ in EVENTS if title not in {'A Divergência', 'Tal’Dorei em 836 P.D.'}}


def uid(key: str) -> str:
    return str(uuid.uuid5(WORLD_ID, key))


def paragraph(text: str) -> dict:
    return {'type': 'paragraph', 'content': [{'type': 'text', 'text': text}]}


def heading(text: str, level: int = 2) -> dict:
    return {'type': 'heading', 'attrs': {'level': level}, 'content': [{'type': 'text', 'text': text}]}


def clean_book_text(text: str) -> str:
    text = re.sub(r'-\s*\n\s*-', '-', text)
    text = re.sub(r'-\s*\n\s*', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def deity_heading(title: str) -> str:
    if title in DEITY_HEADINGS:
        return DEITY_HEADINGS[title]
    article = 'A' if title in {'Comutadora', 'Porta-Lei', 'Mentora Sábia', 'Mãe Selvagem',
                               'Luz Eterna', 'Matrona dos Corvos', 'Tecelã da Lua',
                               'Rainha Aranha', 'Tirana Escamada', 'Serpente Encoberta'} else 'O'
    return f'{article} {title}'


def deity_detail(text: str, title: str, next_title: str | None, domains: list[str] | None,
                 page: int, pantheon: str) -> dict:
    start_heading = deity_heading(title)
    start = re.search(r'(?m)^' + re.escape(start_heading).replace(r'\ ', r'\s+') + r'\s*$', text)
    if not start:
        raise ValueError(f'Cabeçalho da divindade não encontrado: {title}, página {page}')
    rest = text[start.end():]
    if next_title:
        end_heading = deity_heading(next_title)
        end = re.search(r'(?m)^' + re.escape(end_heading).replace(r'\ ', r'\s+') + r'\s*$', rest)
        if not end:
            raise ValueError(f'Próximo cabeçalho não encontrado: {next_title}, página {page}')
        rest = rest[:end.start()]

    labels = list(re.finditer(r'(?m)^(Representação|Domínios Divinos|Dia Sagrado|Inimigos)\.\s*', rest))
    sections = [('Visão geral', rest[:labels[0].start()] if labels else rest)]
    for index, match in enumerate(labels):
        end = labels[index + 1].start() if index + 1 < len(labels) else len(rest)
        sections.append((match.group(1), rest[match.end():end]))

    blocks = [heading('Panteão'), paragraph(pantheon)]
    for name, body in sections:
        if name == 'Domínios Divinos':
            blocks.append(heading(name))
            blocks.append({'type': 'bulletList', 'content': [
                {'type': 'listItem', 'content': [paragraph(domain)]} for domain in domains or []
            ]} if domains else paragraph('O livro não informa domínios divinos para este ídolo menor.'))
            continue
        main, _, commandments = body.partition('Mandamentos d')
        cleaned = clean_book_text(main)
        if cleaned:
            blocks.extend([heading(name), paragraph(cleaned)])
        if commandments:
            blocks.extend([heading('Mandamentos'), paragraph(clean_book_text('Mandamentos d' + commandments))])
    if not any(name == 'Domínios Divinos' for name, _ in sections):
        blocks.extend([heading('Domínios Divinos'), paragraph('O livro não informa domínios divinos para este ídolo menor.')])
    blocks.extend([heading('Fonte'), paragraph(f'Tal’Dorei Renascido, página {page}. A transcrição integral da página está nos documentos de referência do atlas.')])
    return {'format': 'tiptap-json', 'schemaVersion': 2,
            'pages': [{'id': 'principal', 'title': 'Principal', 'body': {'type': 'doc', 'content': blocks}}]}


def content(pages: list[tuple[int, str]]) -> dict:
    return {
        'format': 'tiptap-json', 'schemaVersion': 2,
        'pages': [
            {'id': f'pagina-{number}', 'title': f'Página {number}',
             'body': {'type': 'doc', 'content': [paragraph(line) for line in text.splitlines() if line.strip()] or [paragraph('Página sem texto extraível.')]}}
            for number, text in pages
        ],
    }


def one_detail_content(pages: list[tuple[int, str]], date_note: str) -> dict:
    blocks = [paragraph(date_note)]
    for number, text in pages:
        blocks.append(paragraph(f'Fonte: página {number} do livro'))
        blocks.extend(paragraph(line) for line in text.splitlines() if line.strip())
    return {'format': 'tiptap-json', 'schemaVersion': 2,
            'pages': [{'id': 'principal', 'title': 'Principal', 'body': {'type': 'doc', 'content': blocks}}]}


def book_pages(texts: list[str], start: int, end: int) -> list[tuple[int, str]]:
    """The leading empty entry makes printed page N available at index N + 1."""
    return [(number, texts[number + 1]) for number in range(start, min(end, len(texts) - 2) + 1)]


def entity(key: str, title: str, kind: str, pages: list[tuple[int, str]], properties: dict | None = None,
           detail_note: str | None = None, custom_content: dict | None = None) -> dict:
    ident = uid(key)
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower().translate(str.maketrans('áàâãéêíóôõúç’', 'aaaaeeiooouc-'))).strip('-')
    metadata = {
        'id': ident, 'worldId': str(WORLD_ID), 'type': kind, 'title': title, 'slug': slug or ident,
        'aliases': [], 'tags': ['Tal’Dorei Renascido', f'Fonte: página {pages[0][0]}'] if pages else ['Tal’Dorei Renascido'],
        'properties': properties or {}, 'relations': [], 'schemaVersion': 4,
        'createdAt': STAMP, 'updatedAt': STAMP,
    }
    folder = OUT / 'entities' / ident
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    details = custom_content or (one_detail_content(pages, detail_note) if detail_note else content(pages))
    (folder / 'content.json').write_text(json.dumps(details, ensure_ascii=False), encoding='utf-8')
    return metadata


def world() -> dict:
    types = json.loads((ROOT / 'scripts' / 'taldorei-entity-types.json').read_text(encoding='utf-8'))
    for item in types:
        item['showInSidebar'] = True
        item['properties'].append({'key': 'sourcePage', 'label': 'Página da fonte', 'kind': 'number'})
        if item['id'] == 'location':
            location_type = next(prop for prop in item['properties'] if prop['key'] == 'locationType')
            location_type['options'].append('Povoado')
            item['properties'].append({'key': 'population', 'label': 'População', 'kind': 'text'})
        if item['id'] == 'organization':
            next(prop for prop in item['properties'] if prop['key'] == 'organizationType')['options'].append('Facção ou sociedade')
        if item['id'] == 'event':
            item['properties'].append({'key': 'dateBasis', 'label': 'Base da data', 'kind': 'textarea'})
        if item['id'] == 'document':
            item['showInSidebar'] = True
            next(prop for prop in item['properties'] if prop['key'] == 'documentType')['options'].append('Transcrição extraída do PDF')
            item['properties'].append({'key': 'pageRange', 'label': 'Páginas', 'kind': 'text'})
    month_data = [('Horisal', 29), ('Misuthar', 30), ('Dualahei', 30), ('Thunsheer', 31), ('Unndilar', 28), ('Brussendar', 31), ('Sydenastro', 32), ('Fessuran', 29), ('Quen’pillar', 27), ('Cuersaar', 29), ('Duscar', 32)]
    return {
        'id': str(WORLD_ID), 'slug': 'taldorei-renascido-completo', 'name': 'Tal’Dorei Renascido — Atlas completo',
        'description': 'Atlas estruturado do livro Tal’Dorei Renascido; cenário descrito em 836 P.D.',
        'entityTypes': types, 'timelineScaleDefaults': {item['id']: 'year' for item in types},
        'calendar': {'daysOfWeek': ['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', 'Da’leysen'], 'weekdayOffset': 6,
                     'months': [{'name': name, 'length': days} for name, days in month_data], 'hoursPerDay': 24,
                     'eras': {'before': 'Antes da Divergência', 'after': 'Pós-Divergência'},
                     'origin': {'name': 'Divergência', 'month': 1, 'day': 1}, 'intercalaryRules': []},
        'schemaVersion': 19, 'createdAt': STAMP, 'updatedAt': STAMP,
    }


def main(pdf_path: Path) -> None:
    reader = PdfReader(str(pdf_path))
    if len(reader.pages) < 280:
        raise ValueError('O PDF não parece ser a edição completa de Tal’Dorei Renascido.')
    texts = [''] + [page.extract_text() or '' for page in reader.pages]
    OUT.mkdir(parents=True, exist_ok=True)
    definition = world()
    (OUT / 'world.json').write_text(json.dumps(definition, ensure_ascii=False, indent=2), encoding='utf-8')
    records = []
    for title, first, last in REGIONS:
        props = {'locationType': 'Região', 'sourcePage': first}
        if title in {'Issylra', 'Marquet', 'Os Dentes Partidos', 'Wildemount'}:
            props['parentLocation'] = uid('region:Outras Terras de Exandria')
        records.append(entity('region:' + title, title, 'location', book_pages(texts, first, last), props))
    region_ids = {title: uid('region:' + title) for title, _, _ in REGIONS}
    for index, (title, first, parent) in enumerate(SETTLEMENTS):
        next_start = next((start for _, start, region in SETTLEMENTS[index + 1:] if region == parent and start > first), None)
        region_end = next(last for region, _, last in REGIONS if region == parent)
        last = min(region_end, (next_start - 1) if next_start else region_end)
        opening = texts[first + 1]
        match = re.search(r'(?:Metrópole|Cidade(?: Pequena)?|Povoado(?: Grande| Pequeno)?|Vila(?: Grande|s Dispersas)?):\s*População:\s*([\d.]+)', opening)
        population = match.group(1) if match else None
        population = {'Martelo-do-Rochedo': '73.550', 'Emon': '365.026'}.get(title, population)
        props = {'locationType': 'Cidade' if title in {'Vasselheim', 'Shamal', 'Ank’Harel', 'Ruukva', 'Emon', 'Martelo-do-Rochedo'} or match and any(word in match.group(0) for word in ('Cidade', 'Metrópole')) else 'Povoado',
                 'parentLocation': region_ids[parent], 'sourcePage': first}
        if population: props['population'] = population
        records.append(entity('settlement:' + title, title, 'location', book_pages(texts, first, max(first, last)), props))
    for title, first, parent in SITES:
        records.append(entity('site:' + title, title, 'location', book_pages(texts, first, first),
                              {'locationType': 'Outro', 'parentLocation': region_ids[parent], 'sourcePage': first}))
    headquarters = {'Câmara de Pedra-Alva': 'Pedra-Alva', 'Casas de Martelo-do-Rochedo': 'Martelo-do-Rochedo', 'Guardiões de Syngorn': 'Syngorn'}
    for title, first, last in FACTIONS:
        props = {'organizationType': 'Facção ou sociedade', 'sourcePage': first}
        if title in headquarters: props['headquarters'] = uid('settlement:' + headquarters[title])
        records.append(entity('faction:' + title, title, 'organization', book_pages(texts, first, last), props))
    for title, first, last in PEOPLES:
        records.append(entity('people:' + title, title, 'species', book_pages(texts, first, last),
                              {'recordKind': 'Espécie', 'sourcePage': first}))
    for index, (title, page, pantheon) in enumerate(DEITIES):
        next_title = DEITIES[index + 1][0] if index + 1 < len(DEITIES) and DEITIES[index + 1][1] == page else None
        domains = DEITY_DOMAINS.get(title)
        records.append(entity('deity:' + title, title, 'cosmology', book_pages(texts, page, page),
                              {'cosmologyType': 'Divindade', 'pantheon': pantheon, 'sourcePage': page,
                               **({'domains': domains} if domains else {})},
                              custom_content=deity_detail(texts[page + 1], title, next_title, domains, page, pantheon)))
    for title, page, kind in COSMOS:
        records.append(entity('cosmos:' + title, title, 'cosmology', book_pages(texts, page, page),
                              {'cosmologyType': kind, 'sourcePage': page}))
    for title, first, last, home, affiliation in CHARACTERS:
        props = {'sourcePage': first}
        if home: props['currentLocation'] = uid('settlement:' + home)
        if affiliation: props['affiliation'] = uid('faction:' + affiliation)
        records.append(entity('character:' + title, title, 'character', book_pages(texts, first, last), props))
    for title, page in ARTIFACTS:
        records.append(entity('artifact:' + title, title, 'artifact', book_pages(texts, page, page),
                              {'artifactType': 'Item mágico' if page < 200 else 'Vestígio da Divergência', 'sourcePage': page}))
    for title, page in CREATURES:
        props = {'creatureKind': 'Animal' if title == 'Vaca das Planícies' else 'Monstro',
                 'dangerLevel': 'Desconhecido', 'sourcePage': page}
        if title == 'Serpentinos Vos’skyriss': props['habitat'] = uid('site:Ilha Visa')
        records.append(entity('creature:' + title, title, 'creature', book_pages(texts, page, page), props))
    for title, first, last, year, place in EVENTS:
        props = {'eventStatus': 'Em andamento' if title.startswith('Despertar') else 'Concluído', 'sourcePage': first}
        if place: props['location'] = uid('settlement:' + place) if place != 'Ilha Visa' else uid('site:Ilha Visa')
        estimated = title in ESTIMATED_EVENT_YEARS
        props['eventDate'] = {'start': {'year': year, **({'approximate': True} if estimated else {})}}
        props['dateBasis'] = ('Ano estimado para ordenar a linha do tempo; o livro não informa um ano exato para este evento.'
                              if estimated else 'Ano indicado pela cronologia do livro.')
        display_year = f'{abs(year)} antes da Divergência' if year < 0 else f'{year} P.D.'
        date_note = f"Data no atlas: {'aproximadamente ' if estimated else ''}{display_year}. {props['dateBasis']}"
        records.append(entity('event:' + title, title, 'event', book_pages(texts, first, last), props, detail_note=date_note))

    records.append(entity('tale:mito-exandria', 'Mito de Exandria', 'tale', book_pages(texts, 12, 17),
                          {'taleType': 'Mito', 'sourcePage': 12}))
    records.append(entity('tale:origens-taldorei', 'Origens de Tal’Dorei', 'tale', book_pages(texts, 18, 26),
                          {'taleType': 'Crônica', 'sourcePage': 18}))
    for title, page, category in [('Hemofício', 165, 'Magia'), ('Portão Divino', 11, 'Cosmologia'),
                                   ('Vestígios da Divergência', 200, 'Itens mágicos'),
                                   ('Calendário Exandriano', 8, 'Calendário')]:
        records.append(entity('concept:' + title, title, 'concept', book_pages(texts, page, min(page + 1, 283)),
                              {'category': category, 'sourcePage': page}))
    for title, page, kind in [('Fendas Elementais', 10, 'Planar'),
                               ('Linhas ley da Vastidão Verdejante', 121, 'Mágico'),
                               ('Ruidus cheia', 9, 'Astronômico')]:
        records.append(entity('phenomenon:' + title, title, 'phenomenon', book_pages(texts, page, page),
                              {'phenomenonType': kind, 'sourcePage': page}))
    for title, page, subtype, place in [('Ecossistema do Pântano K’Tawl', 67, 'Ecossistema', 'Pântano K’Tawl'),
                                         ('Coral do Sono', 129, 'Flora', 'Baía da Adaga'),
                                         ('Árvore-Fantasma', 228, 'Flora', None),
                                         ('Vaca das Planícies', 259, 'Fauna', None)]:
        props = {'discipline': 'Natureza', 'scienceSubtype': subtype, 'sourcePage': page}
        if place: props['habitat'] = uid('site:' + place)
        records.append(entity('science:' + title, title, 'naturalScience', book_pages(texts, page, page), props))

    awakening = uid('event:Despertar dos serpentinos Vos’skyriss')
    island = uid('site:Ilha Visa')
    records.append(entity('case:voskyriss', 'Despertar de Vos’skyriss', 'case', book_pages(texts, 145, 145),
                          {'caseStatus': 'Aberto', 'relatedLocations': [island], 'sourcePage': 145}))
    records.append(entity('case:cratera-emon', 'Mistério da cratera de Emon', 'case', book_pages(texts, 137, 142),
                          {'caseStatus': 'Não resolvido', 'relatedLocations': [uid('settlement:Emon')], 'sourcePage': 137}))
    records.append(entity('evidence:voskyriss-camara', 'Câmara de êxtase de Vos’sykriss', 'evidence', book_pages(texts, 145, 145),
                          {'evidenceFormat': 'Pista', 'evidenceType': 'Físico', 'relatedEvent': awakening,
                           'foundAt': island, 'sourcePage': 145}))
    records.append(entity('evidence:luxon', 'Sinais de Luxon', 'evidence', book_pages(texts, 41, 41),
                          {'evidenceFormat': 'Pista', 'evidenceType': 'Físico', 'sourcePage': 41}))
    records.append(entity('clue:awakening', 'Fim do campo de êxtase', 'clue', book_pages(texts, 145, 145),
                          {'relatedEvent': awakening, 'sourcePage': 145}))

    for key, title, event_titles in [
        ('exandria', 'História de Exandria', [row[0] for row in EVENTS[:5]]),
        ('taldorei', 'História de Tal’Dorei', [row[0] for row in EVENTS[5:]]),
    ]:
        first = 12 if key == 'exandria' else 18
        timeline = entity('timeline:' + key, title, 'timeline', book_pages(texts, first, first),
                          {'scope': 'História e acontecimentos do cenário', 'sourcePage': first})
        records.append(timeline)
        by_title = {row[0]: row for row in EVENTS}
        appearances = []
        for event_title in event_titles:
            _, page, _, year, _ = by_title[event_title]
            date = {'start': {'year': year, **({'approximate': True} if event_title in ESTIMATED_EVENT_YEARS else {})}}
            appearances.append({'id': uid('appearance:' + key + ':' + event_title), 'entityId': uid('event:' + event_title),
                                'title': None, 'note': f'Livro, p. {page}', 'date': date,
                                'minimumScale': None, 'showCover': False})
        folder = OUT / 'entities' / timeline['id']
        (folder / 'timeline.json').write_text(json.dumps({'schemaVersion': 2, 'worldId': str(WORLD_ID),
                                                           'timelineId': timeline['id'], 'updatedAt': STAMP,
                                                           'appearances': appearances}, ensure_ascii=False, indent=2), encoding='utf-8')
    # Full extracted text remains browsable, including history, pantheon, gazetteer,
    # character options, game master material, allies, adversaries, and indexes.
    for first in range(1, len(texts), 20):
        last = min(first + 19, len(texts) - 1)
        title = f'Livro — páginas {first}–{last}'
        records.append(entity('source:' + str(first), title, 'document', [(number, texts[number]) for number in range(first, last + 1)],
                              {'documentType': 'Transcrição extraída do PDF', 'pageRange': f'{first}–{last}'}))
    by_id = {record['id']: record for record in records}
    faction_members = {
        'Arcana Pansófica': ['Allura Vysoren'],
        'Câmara de Pedra-Alva': ['Percival de Rolo'],
        'Os Ashari': ['Keyleth'],
        'Vox Machina': ['Grog Strongjaw', 'Keyleth', 'Vex’ahlia de Rolo', 'Pike Trickfoot',
                        'Scanlan Shorthalt', 'Taryon Darrington', 'Vax’ildan', 'Percival de Rolo'],
    }
    for faction, people in faction_members.items():
        by_id[uid('faction:' + faction)]['properties']['members'] = [uid('character:' + name) for name in people]
    species_habitats = {
        'Anões': ['Martelo-do-Rochedo', 'Cinzaforte'], 'Elfos': ['Syngorn', 'Lyrengorn'],
        'Meio-Gigantes': ['Trilhoeste'], 'Humanos': ['Emon', 'Pedra-Alva'],
        'Pequeninos': ['Campos Turst'],
    }
    for people, homes in species_habitats.items():
        by_id[uid('people:' + people)]['properties']['habitats'] = [uid('settlement:' + name) for name in homes]
    by_id[uid('event:Ascensão de Zan Tal’Dorei')]['properties']['participants'] = [uid('character:Zan Tal’Dorei')]
    for event_title in ['Conclave Croma em Emon', 'Ascensão e derrota d’O Sussurrado']:
        by_id[uid('event:' + event_title)]['properties']['participants'] = [uid('character:' + name) for name in faction_members['Vox Machina']]
    by_id[uid('artifact:Fenthras')]['properties']['owner'] = uid('character:Vex’ahlia de Rolo')
    by_id[uid('artifact:Ramo da Confluência')]['properties']['owner'] = uid('character:Keyleth')

    property_definitions = {item['id']: item['properties'] for item in definition['entityTypes']}
    for record in records:
        for prop in property_definitions[record['type']]:
            if prop['kind'] not in ('reference', 'referenceList'): continue
            value = record['properties'].get(prop['key'])
            targets = value if isinstance(value, list) else ([value] if value else [])
            for target in targets:
                if target not in by_id: raise ValueError(f'Referência ausente: {record["title"]} -> {target}')
                record['relations'].append({'id': uid('relation:' + record['id'] + ':' + prop['key'] + ':' + target),
                                            'sourceId': record['id'], 'targetId': target,
                                            'type': 'referência', 'label': prop['label'], 'directional': True})
        folder = OUT / 'entities' / record['id']
        (folder / 'metadata.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    report = {'source': pdf_path.name, 'pdfPages': len(reader.pages), 'entities': len(records),
              'regions': len(REGIONS), 'settlements': len(SETTLEMENTS), 'sites': len(SITES),
              'factions': len(FACTIONS), 'sourceDocuments': (len(texts) - 1 + 19) // 20,
              'byType': {kind: sum(record['type'] == kind for record in records) for kind in sorted({record['type'] for record in records})},
              'pagesWithoutExtractedText': [i for i in range(1, len(texts)) if not texts[i].strip()]}
    (OUT / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'deity-domains.json').write_text(json.dumps(DEITY_DOMAINS, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/build-taldorei-world.py CAMINHO_DO_PDF')
    main(Path(sys.argv[1]))
