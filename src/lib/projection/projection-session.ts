'use client'

import { useSyncExternalStore } from 'react'
import type { ProjectionMessage } from '@/domain/projection/projection'
import { BroadcastChannelProjectionTransport } from '@/lib/projection/broadcast-channel-transport'

export interface ProjectionSessionSnapshot {
  /** A projection was started and has not been stopped explicitly. */
  active: boolean
  /** The projection window answered recently (it is open and alive). */
  connected: boolean
}

const WINDOW_NAME = 'canon-codex-projection'
const WINDOW_FEATURES = 'popup=yes,width=1280,height=720'
const STALE_AFTER_MS = 5000

/**
 * The GM-side end of the projection. It is a module singleton (not React state) so the projection
 * window, and the music it plays, stay connected while the GM moves between scenes and pages. The
 * Scene Runner and the soundtrack player both talk to the window through it.
 */
class ProjectionSession {
  private transport: BroadcastChannelProjectionTransport | null = null
  private unsubscribeTransport: (() => void) | null = null
  private windowRef: Window | null = null
  private sessionId: string | null = null
  private lastPing = 0
  private healthTimer: number | null = null
  private handlers = new Set<(message: ProjectionMessage) => void>()
  private storeListeners = new Set<() => void>()
  private snapshot: ProjectionSessionSnapshot = { active: false, connected: false }

  isActive(): boolean { return this.snapshot.active }
  isConnected(): boolean { return this.snapshot.connected }
  getSnapshot = (): ProjectionSessionSnapshot => this.snapshot
  subscribeStore = (listener: () => void): (() => void) => {
    this.storeListeners.add(listener)
    return () => { this.storeListeners.delete(listener) }
  }

  /** Receives every message the projection window sends (ready, full-state requests, audio status...). */
  subscribe(handler: (message: ProjectionMessage) => void): () => void {
    this.handlers.add(handler)
    return () => { this.handlers.delete(handler) }
  }

  publish(message: ProjectionMessage) { this.transport?.publish(message) }

  /** Must run inside a click handler: it opens the popup window. */
  start() {
    if (!this.snapshot.active) {
      const sessionId = `projection-${crypto.randomUUID()}`
      const transport = new BroadcastChannelProjectionTransport()
      transport.connect(sessionId)
      this.sessionId = sessionId
      this.transport = transport
      this.lastPing = 0
      this.unsubscribeTransport = transport.subscribe((message) => this.receive(message))
      this.healthTimer = window.setInterval(() => this.checkHealth(), 2000)
      this.setSnapshot({ active: true, connected: false })
    }
    this.openWindow()
  }

  openWindow() {
    if (!this.sessionId) return
    this.windowRef = window.open(`/projection/${this.sessionId}`, WINDOW_NAME, WINDOW_FEATURES)
    this.windowRef?.focus()
  }

  stop() {
    if (!this.snapshot.active) return
    this.transport?.publish({ type: 'PROJECTION_STOPPED' })
    this.unsubscribeTransport?.()
    this.transport?.disconnect()
    if (this.healthTimer !== null) window.clearInterval(this.healthTimer)
    this.transport = null
    this.unsubscribeTransport = null
    this.healthTimer = null
    this.sessionId = null
    this.windowRef = null
    this.lastPing = 0
    this.setSnapshot({ active: false, connected: false })
  }

  private receive(message: ProjectionMessage) {
    if (message.type === 'PROJECTION_READY' || message.type === 'PING' || message.type === 'REQUEST_FULL_STATE') {
      this.lastPing = Date.now()
      if (message.type === 'PING') this.transport?.publish({ type: 'PONG' })
      if (!this.snapshot.connected) this.setSnapshot({ active: true, connected: true })
    }
    for (const handler of this.handlers) handler(message)
  }

  private checkHealth() {
    if (this.snapshot.connected && this.lastPing && Date.now() - this.lastPing > STALE_AFTER_MS) this.setSnapshot({ active: true, connected: false })
  }

  private setSnapshot(next: ProjectionSessionSnapshot) {
    if (next.active === this.snapshot.active && next.connected === this.snapshot.connected) return
    this.snapshot = next
    for (const listener of this.storeListeners) listener()
  }
}

export const projectionSession = new ProjectionSession()

const SERVER_SNAPSHOT: ProjectionSessionSnapshot = { active: false, connected: false }

export function useProjectionSession(): ProjectionSessionSnapshot {
  return useSyncExternalStore(projectionSession.subscribeStore, projectionSession.getSnapshot, () => SERVER_SNAPSHOT)
}
