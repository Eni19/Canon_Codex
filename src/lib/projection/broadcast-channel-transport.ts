import type { ProjectionMessage, ProjectionTransport } from '@/domain/projection/projection'

const CHANNEL_PREFIX = 'canon-codex:projection:'

export class BroadcastChannelProjectionTransport implements ProjectionTransport {
  private channel: BroadcastChannel | null = null
  private handlers = new Set<(message: ProjectionMessage) => void>()

  connect(sessionId: string) {
    this.disconnect()
    this.channel = new BroadcastChannel(`${CHANNEL_PREFIX}${sessionId}`)
    this.channel.onmessage = (event: MessageEvent<ProjectionMessage>) => {
      for (const handler of this.handlers) handler(event.data)
    }
  }

  publish(message: ProjectionMessage) { this.channel?.postMessage(message) }

  subscribe(handler: (message: ProjectionMessage) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    this.channel?.close()
    this.channel = null
  }
}
