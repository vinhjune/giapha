import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { EventItem } from '../types/giapha'

interface EventFormState {
  title: string
  description: string
  dateText: string
  year: string
  month: string
  day: string
  isLunar: boolean
  isRecurring: boolean
}

const emptyFormState: EventFormState = {
  title: '',
  description: '',
  dateText: '',
  year: '',
  month: '',
  day: '',
  isLunar: false,
  isRecurring: false,
}

function buildEventPayload(form: EventFormState) {
  const payload: {
    title: string
    description?: string
    dateText?: string
    year?: number
    month?: number
    day?: number
    isLunar: boolean
    isRecurring: boolean
  } = {
    title: form.title.trim(),
    isLunar: form.isLunar,
    isRecurring: form.isRecurring,
  }

  if (form.description.trim()) payload.description = form.description.trim()
  if (form.dateText.trim()) payload.dateText = form.dateText.trim()
  if (form.year.trim()) payload.year = Number(form.year)
  if (form.month.trim()) payload.month = Number(form.month)
  if (form.day.trim()) payload.day = Number(form.day)

  return payload
}

function formatDateHint(event: EventItem) {
  if (event.dateText) return event.dateText

  const parts = [event.day, event.month, event.year].filter(value => value !== null)
  if (parts.length === 3) return `${event.day}/${event.month}/${event.year}`

  const labeledParts = [
    event.day !== null ? `Ngày ${event.day}` : null,
    event.month !== null ? `Tháng ${event.month}` : null,
    event.year !== null ? `Năm ${event.year}` : null,
  ].filter(Boolean)

  return labeledParts.join(' • ')
}

function getFormStateFromEvent(event: EventItem): EventFormState {
  return {
    title: event.title,
    description: event.description ?? '',
    dateText: event.dateText ?? '',
    year: event.year?.toString() ?? '',
    month: event.month?.toString() ?? '',
    day: event.day?.toString() ?? '',
    isLunar: event.isLunar,
    isRecurring: event.isRecurring,
  }
}

export default function EventManagementView() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [createForm, setCreateForm] = useState<EventFormState>(emptyFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(emptyFormState)

  async function refresh() {
    setLoading(true)
    try {
      const nextEvents = await api.listEvents()
      setEvents(nextEvents)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function resetCreateForm() {
    setCreateForm(emptyFormState)
  }

  function startEdit(event: EventItem) {
    setError(null)
    setEditingId(event.id)
    setEditForm(getFormStateFromEvent(event))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyFormState)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createEvent(buildEventPayload(createForm))
      setFormOpen(false)
      resetCreateForm()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setError(null)
    try {
      await api.updateEvent(id, buildEventPayload(editForm))
      cancelEdit()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await api.deleteEvent(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold text-gray-800">Quản lý sự kiện</h2>
        <button
          onClick={() => setFormOpen(value => !value)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Thêm sự kiện
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3">
          <div>
            <label htmlFor="new-event-title" className="block text-sm text-gray-600 mb-1">Tiêu đề</label>
            <input
              id="new-event-title"
              value={createForm.title}
              onChange={e => setCreateForm(current => ({ ...current, title: e.target.value }))}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-event-description" className="block text-sm text-gray-600 mb-1">Mô tả</label>
            <textarea
              id="new-event-description"
              value={createForm.description}
              onChange={e => setCreateForm(current => ({ ...current, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-event-date-text" className="block text-sm text-gray-600 mb-1">Ngày</label>
            <input
              id="new-event-date-text"
              value={createForm.dateText}
              onChange={e => setCreateForm(current => ({ ...current, dateText: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="new-event-year" className="block text-sm text-gray-600 mb-1">Năm</label>
              <input
                id="new-event-year"
                type="number"
                value={createForm.year}
                onChange={e => setCreateForm(current => ({ ...current, year: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-event-month" className="block text-sm text-gray-600 mb-1">Tháng</label>
              <input
                id="new-event-month"
                type="number"
                value={createForm.month}
                onChange={e => setCreateForm(current => ({ ...current, month: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-event-day" className="block text-sm text-gray-600 mb-1">Ngày số</label>
              <input
                id="new-event-day"
                type="number"
                value={createForm.day}
                onChange={e => setCreateForm(current => ({ ...current, day: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={createForm.isLunar}
              onChange={e => setCreateForm(current => ({ ...current, isLunar: e.target.checked }))}
            />
            Âm lịch
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={createForm.isRecurring}
              onChange={e => setCreateForm(current => ({ ...current, isRecurring: e.target.checked }))}
            />
            Lặp lại hàng năm
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                resetCreateForm()
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Tạo
            </button>
          </div>
        </form>
      )}

      {loading && <p role="status" className="text-sm text-gray-400">Đang tải…</p>}

      <ul className="space-y-2">
        {events.map(event => (
          <li key={event.id} className="border border-gray-200 rounded-lg p-3">
            {editingId === event.id ? (
              <form onSubmit={e => handleSaveEdit(e, event.id)} className="flex flex-col gap-3">
                <div>
                  <label htmlFor={`edit-event-title-${event.id}`} className="block text-sm text-gray-600 mb-1">Tiêu đề</label>
                  <input
                    id={`edit-event-title-${event.id}`}
                    value={editForm.title}
                    onChange={e => setEditForm(current => ({ ...current, title: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-event-description-${event.id}`} className="block text-sm text-gray-600 mb-1">Mô tả</label>
                  <textarea
                    id={`edit-event-description-${event.id}`}
                    value={editForm.description}
                    onChange={e => setEditForm(current => ({ ...current, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-event-date-text-${event.id}`} className="block text-sm text-gray-600 mb-1">Ngày</label>
                  <input
                    id={`edit-event-date-text-${event.id}`}
                    value={editForm.dateText}
                    onChange={e => setEditForm(current => ({ ...current, dateText: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`edit-event-year-${event.id}`} className="block text-sm text-gray-600 mb-1">Năm</label>
                    <input
                      id={`edit-event-year-${event.id}`}
                      type="number"
                      value={editForm.year}
                      onChange={e => setEditForm(current => ({ ...current, year: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor={`edit-event-month-${event.id}`} className="block text-sm text-gray-600 mb-1">Tháng</label>
                    <input
                      id={`edit-event-month-${event.id}`}
                      type="number"
                      value={editForm.month}
                      onChange={e => setEditForm(current => ({ ...current, month: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor={`edit-event-day-${event.id}`} className="block text-sm text-gray-600 mb-1">Ngày số</label>
                    <input
                      id={`edit-event-day-${event.id}`}
                      type="number"
                      value={editForm.day}
                      onChange={e => setEditForm(current => ({ ...current, day: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.isLunar}
                    onChange={e => setEditForm(current => ({ ...current, isLunar: e.target.checked }))}
                  />
                  Âm lịch
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.isRecurring}
                    onChange={e => setEditForm(current => ({ ...current, isRecurring: e.target.checked }))}
                  />
                  Lặp lại hàng năm
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Lưu
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{event.title}</p>
                  {event.description && <p className="text-sm text-gray-600 mt-1">{event.description}</p>}
                  {formatDateHint(event) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateHint(event)}
                      {event.isLunar && ' (Âm lịch)'}
                      {event.isRecurring && ' (Hàng năm)'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(event)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    aria-label={`Xóa sự kiện ${event.title}`}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
