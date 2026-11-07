import { projectCardFields, type ProjectLine } from "@/lib/builder/project-card";

export default function ProjectCardLines({ card }: { card: Record<ProjectLine, string> }) {
  return <dl className="mt-3 space-y-3">
    {(Object.keys(projectCardFields) as ProjectLine[]).map(field => <div key={field} className="min-w-0">
      <dt className="text-xs font-semibold text-amber-900">{projectCardFields[field]}</dt>
      <dd className="mt-1 break-words text-sm leading-6 text-stone-700">{card[field]}</dd>
    </div>)}
  </dl>;
}
