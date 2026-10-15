import { ContentRenderer } from '@/components/editor/content-renderer'
import { PropertyDisplayList } from '@/components/entities/property-display-list'
import { TimelineInteractiveView } from '@/components/entities/timeline-interactive-view'
import { TimelineScaleSettings } from '@/components/entities/timeline-scale-settings'
import { BacklinksPanel } from '@/components/entities/backlinks-panel'
import { RelationsPanel } from '@/components/entities/relations-panel'
import type { TimelineData } from '@/domain/timelines/timeline'
import type { EntityPageProps } from './entity-page'
import styles from './timeline.module.css'

export function TimelineEntityPage({ entity, entityType, worldName, content, entityTitleById, backlinks, relationTargetOptions, allEntities, timelineRecords, typeLabels, timelineScaleDefaults, timelineTypes, calendar, timeline }: EntityPageProps & { timeline: TimelineData }) {
  return <div className={styles.page}>
    <TimelineInteractiveView title={entity.title} worldName={worldName} worldId={entity.worldId} timelineId={entity.id} timeline={timeline} calendar={calendar} records={allEntities} timelineRecords={timelineRecords} typeLabels={typeLabels} scaleDefaults={timelineScaleDefaults} details={<div className="space-y-8">
      <TimelineScaleSettings worldId={entity.worldId} types={timelineTypes} defaults={timelineScaleDefaults} />
      {entityType.properties.length > 0 && <section><h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Propriedades da linha</h2><PropertyDisplayList properties={entityType.properties} values={entity.properties} entityTitleById={entityTitleById} calendar={calendar} /></section>}
      <section><h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Conteúdo da linha</h2><ContentRenderer content={content} /></section>
      <section><h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Relacionado</h2><RelationsPanel entityId={entity.id} relations={entity.relations} entityTitleById={entityTitleById} targetOptions={relationTargetOptions} /></section>
      <section><h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Backlinks</h2><BacklinksPanel backlinks={backlinks} /></section>
    </div>} />
  </div>
}
