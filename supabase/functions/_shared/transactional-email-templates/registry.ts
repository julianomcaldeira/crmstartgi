import type * as React from 'npm:react@18.3.1'
import { template as wonNotification } from './won-notification.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: (props: any) => React.ReactElement
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: any) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: any
  to?: string | string[]
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'won-notification': wonNotification,
}
