import { ProjectionWindow } from '@/components/scenes/projection-window'

export default async function ProjectionPage({params}:{params:Promise<{sessionId:string}>}){
  const {sessionId}=await params
  return <ProjectionWindow sessionId={sessionId}/>
}
