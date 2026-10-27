import type { Task } from '../../domain/types'

export type TaskImportPlan = {
  localTaskCount: number
  addTasks: Task[]
  completionTasks: Task[]
  duplicateCount: number
  conflictCount: number
  unsupportedIdCount: number
}

export type TaskImportSummary = {
  importedCount: number
  duplicateCount: number
  conflictCount: number
  unsupportedIdCount: number
  completionDateCount: number
}
