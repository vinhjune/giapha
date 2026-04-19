import { useRef, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { importSingleCsvToGiapha } from '../utils/csvImport'
import type { ImportResult } from '../utils/csvImport'

interface Props {
  onClose: () => void
}

export default function CsvImportModal({ onClose }: Props) {
  const { data, importData } = useGiaphaStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setReading(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result
      if (typeof text !== 'string') return
      const metadata = data?.metadata ?? {
        tenDongHo: 'Gia phả',
        nguonGoc: '',
        ngayCapNhat: new Date().toISOString(),
      }
      const res = importSingleCsvToGiapha(text, metadata)
      setResult(res)
      setReading(false)
    }
    reader.onerror = () => {
      setReading(false)
      alert('Không đọc được file.')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleImport() {
    if (!result?.data) return
    importData(result.data)
    onClose()
  }

  const hasErrors = result && result.errors.length > 0

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
          Chọn file CSV theo định dạng chuẩn. Dữ liệu hiện tại sẽ bị <strong>thay thế hoàn toàn</strong> sau khi xác nhận nhập.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
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

        {reading && <p className="text-sm text-gray-400">Đang đọc file…</p>}

        {result && (
          <div className="flex flex-col gap-3">
            {/* Stats */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-gray-500">Dòng trong file</span>
              <span className="font-medium">{result.stats.totalRows}</span>
              <span className="text-gray-500">Dòng đọc được</span>
              <span className="font-medium">{result.stats.parsedRows}</span>
              <span className="text-gray-500">Số người</span>
              <span className="font-medium">{result.stats.personCount}</span>
              <span className="text-gray-500">Liên kết hôn nhân</span>
              <span className="font-medium">{result.stats.marriageLinksBuilt}</span>
              <span className="text-gray-500">Liên kết con cái</span>
              <span className="font-medium">{result.stats.childrenLinksBuilt}</span>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  {result.errors.length} lỗi cần sửa trước khi nhập:
                </p>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="shrink-0 font-mono text-xs bg-red-100 px-1 rounded">{e.code}</span>
                      <span>{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-yellow-700 mb-2">
                  {result.warnings.length} cảnh báo / tự sửa:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="shrink-0 font-mono text-xs bg-yellow-100 px-1 rounded">{w.code}</span>
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasErrors && result.data && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  Sẵn sàng nhập <strong>{result.stats.personCount}</strong> người vào gia phả.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleImport}
            disabled={!result?.data || !!hasErrors}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Nhập dữ liệu
          </button>
        </div>
      </div>
    </div>
  )
}
