import { useRef, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { importCsv } from '../services/api'

interface Props {
  onClose: () => void
}

export default function CsvImportModal({ onClose }: Props) {
  const { loadData } = useGiaphaStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ persons: number; families: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError(null)
    setImporting(true)
    importCsv(file)
      .then(res => {
        setResult(res.imported)
        loadData()
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setImporting(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nhập dữ liệu từ CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <p className="text-sm text-gray-500">
          Chọn file CSV theo định dạng chuẩn. Dữ liệu hiện tại sẽ bị <strong>thay thế hoàn toàn</strong> sau khi nhập.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
          >
            Chọn file…
          </button>
          {fileName && <span className="text-sm text-gray-600 truncate">{fileName}</span>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {importing && <p className="text-sm text-gray-400">Đang nhập dữ liệu…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700">
              Đã nhập <strong>{result.persons}</strong> người và <strong>{result.families}</strong> gia đình.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
