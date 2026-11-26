#!/usr/bin/env node
// Verifica a documentação Markdown do repositório sem dependências externas:
// - links relativos apontam para arquivos ou pastas existentes;
// - âncoras (#secao) existem no arquivo de destino, com o slug no formato do GitHub;
// - caminhos `src/...` citados entre crases existem.
// Só lê arquivos versionados ou não ignorados pelo Git; `workspace/` nunca é lido.
// Uso: pnpm docs:check

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function listMarkdownFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], { cwd: root, encoding: 'utf8' })
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => !file.startsWith('workspace/') && !file.startsWith('node_modules/'))
    .filter((file) => existsSync(path.join(root, file)))
}

/** Remove blocos de código cercados, mantendo a numeração de linhas. */
function stripFences(text) {
  const lines = text.split(/\r?\n/)
  let fence = null
  return lines.map((line) => {
    const match = line.match(/^\s*(```+|~~~+)/)
    if (match) {
      if (!fence) fence = match[1][0]
      else if (match[1][0] === fence) fence = null
      return ''
    }
    return fence ? '' : line
  })
}

/** Slug de título no formato usado pelo GitHub. */
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

const anchorCache = new Map()
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file)
  const anchors = new Set()
  const counts = new Map()
  for (const line of stripFences(readFileSync(file, 'utf8'))) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const base = slugify(heading[1])
      const seen = counts.get(base) ?? 0
      anchors.add(seen === 0 ? base : `${base}-${seen}`)
      counts.set(base, seen + 1)
    }
    for (const explicit of line.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) anchors.add(explicit[1])
  }
  anchorCache.set(file, anchors)
  return anchors
}

/** Extrai destinos de links `[texto](destino)`, aceitando parênteses balanceados no caminho. */
function linkTargets(line) {
  const targets = []
  const noCode = line.replace(/`[^`]*`/g, (code) => ' '.repeat(code.length))
  let index = noCode.indexOf('](')
  while (index !== -1) {
    let depth = 1
    let end = index + 2
    while (end < noCode.length && depth > 0) {
      if (noCode[end] === '(') depth += 1
      else if (noCode[end] === ')') depth -= 1
      if (depth > 0) end += 1
    }
    const raw = noCode.slice(index + 2, end).trim().replace(/^<|>$/g, '').split(/\s+"/)[0]
    if (raw) targets.push(raw)
    index = noCode.indexOf('](', end)
  }
  return targets
}

const problems = []
const files = listMarkdownFiles()

for (const file of files) {
  const absolute = path.join(root, file)
  const lines = stripFences(readFileSync(absolute, 'utf8'))
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`

    for (const target of linkTargets(line)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      const [rawPath, anchor] = target.split('#')
      const decoded = decodeURIComponent(rawPath)
      const destination = decoded ? path.resolve(path.dirname(absolute), decoded) : absolute
      const relative = path.relative(root, destination).split(path.sep).join('/')
      if (relative.startsWith('workspace/') || relative === 'workspace') continue
      if (!existsSync(destination)) {
        problems.push(`${where}: link quebrado para ${target}`)
        continue
      }
      if (anchor && destination.endsWith('.md') && statSync(destination).isFile()) {
        if (!anchorsOf(destination).has(decodeURIComponent(anchor).toLowerCase())) {
          problems.push(`${where}: âncora #${anchor} não existe em ${relative}`)
        }
      }
    }

    for (const code of line.matchAll(/`([^`]+)`/g)) {
      const value = code[1].trim()
      if (!/^(\.\.\/)*src\//.test(value)) continue
      if (/[*{}<>\s]/.test(value)) continue
      const cited = value.replace(/^(\.\.\/)+/, '').replace(/[:#].*$/, '')
      if (!existsSync(path.join(root, cited))) problems.push(`${where}: caminho \`${cited}\` não existe`)
    }
  })
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} problema(s) em ${files.length} arquivo(s) Markdown.`)
  process.exit(1)
}
console.log(`Documentação verificada: ${files.length} arquivo(s) Markdown sem links ou caminhos quebrados.`)
