import { useRef, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { exportCsv, importCsv } from '../services/api'

export default function CsvPanel() {
  const { loadData } = useGiaphaStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ persons: number; families: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExportCsv() {
    const blob = await exportCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `gia-pha-export-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    <div className="p-4 flex flex-col gap-6 max-w-lg">
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-2">Xuất dữ liệu ra CSV</h2>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Xuất CSV
        </button>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-2">Nhập dữ liệu từ CSV</h2>
        <p className="text-sm text-gray-500 mb-3">
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
            aria-label="Chọn file CSV để nhập"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {importing && <p className="text-sm text-gray-400 mt-2">Đang nhập dữ liệu…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-green-700">
              Đã nhập <strong>{result.persons}</strong> người và <strong>{result.families}</strong> gia đình.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
