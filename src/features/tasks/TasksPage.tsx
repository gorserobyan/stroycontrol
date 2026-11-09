import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTasks } from '@/api/tasks'
import { useProfile } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { FilteredTaskList } from './FilteredTaskList'
import { TaskFormDialog } from './TaskFormDialog'

export function TasksPage() {
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const title = isManager ? 'Все задачи' : 'Мои задачи'
  useDocumentTitle(title)

  const tasks = useTasks()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description={
          isManager
            ? 'Задачи по всем объектам. Задачи на проверке ждут вашего решения.'
            : 'Задачи, назначенные вам. Откройте задачу, чтобы изменить её статус.'
        }
        actions={
          isManager && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Новая задача
            </Button>
          )
        }
      />

      <FilteredTaskList
        query={tasks}
        empty={
          isManager ? (
            <EmptyState
              icon={ClipboardList}
              title="Задач пока нет"
              description="Создайте задачу и назначьте исполнителя. Объект можно выбрать в форме."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus /> Новая задача
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Вам пока не назначено задач"
              description="Когда постановщик назначит вам задачу, она появится здесь."
            />
          )
        }
      />

      {isManager && <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  )
}
