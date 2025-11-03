import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { motion } from 'framer-motion'

const ACCEPT_FILE_TYPES = '.xlsx,.xls,.csv'

type AnalysisStatus = 'idle' | 'uploading' | 'success' | 'error'

type AnalysisBreakdownItem = {
  department: string
  count: number
  ratio: string
}

type AnalysisStats = {
  processed: number
  unmatched: number
  total: number
  filename: string
  breakdown: AnalysisBreakdownItem[]
} | null

type ApiError = {
  error?: string
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) {
    return null
  }

  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch (error) {
      console.warn('Failed to decode filename from header', error)
    }
  }

  const quotedMatch = header.match(/filename="([^"\\]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const bareMatch = header.match(/filename=([^;]+)/i)
  if (bareMatch?.[1]) {
    return bareMatch[1].trim()
  }

  return null
}

function parseHeaderNumber(value: string | null): number {
  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBreakdownHeader(value: string | null): AnalysisBreakdownItem[] {
  if (!value) {
    return []
  }

  try {
    const decoded = decodeURIComponent(value)
    const payload = JSON.parse(decoded) as unknown

    if (!Array.isArray(payload)) {
      return []
    }

    return payload
      .map((item) => {
        if (item && typeof item === 'object') {
          const data = item as Record<string, unknown>
          const department =
            typeof data.department === 'string'
              ? data.department
              : typeof data['department'] === 'string'
              ? (data['department'] as string)
              : typeof data['权属部门'] === 'string'
              ? (data['权属部门'] as string)
              : ''
          const countValue =
            typeof data.count === 'number'
              ? data.count
              : typeof data['数量'] === 'number'
              ? Number(data['数量'])
              : Number.NaN
          const ratioValue =
            typeof data.ratio === 'string'
              ? data.ratio
              : typeof data['占比'] === 'string'
              ? (data['占比'] as string)
              : ''

          if (!department) {
            return null
          }

          const count = Number.isFinite(countValue) ? countValue : 0
          const ratio = ratioValue || ''

          return { department, count, ratio }
        }

        return null
      })
      .filter((item): item is AnalysisBreakdownItem => Boolean(item))
  } catch (error) {
    console.warn('Failed to parse analysis breakdown header', error)
    return []
  }
}

export default function LedgerAnalysisFeature() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState<AnalysisStats>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [downloadUrl])

  const resetResults = () => {
    setStats(null)
    setMessage('')
    setError('')
    setDownloadUrl(null)
  }

  const isUploading = status === 'uploading'

  const helperText = useMemo(() => {
    if (!selectedFile) {
      return '支持上传 .xlsx、.xls 或 .csv 文件，需包含“答复内容”列。'
    }

    return `已选择文件：${selectedFile.name}`
  }, [selectedFile])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setStatus('idle')
    resetResults()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setError('请先选择需要分析的文件。')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    resetResults()
    setStatus('uploading')
    setMessage('正在分析，请稍候…')

    try {
      const response = await fetch('/api/ledger-analysis', {
        method: 'POST',
        body: formData
      })

      const contentType = response.headers.get('content-type') ?? ''

      if (!response.ok) {
        if (contentType.includes('application/json')) {
          const payload = (await response.json()) as ApiError
          setError(payload?.error ?? '分析失败，请稍后重试。')
        } else {
          setError('分析失败，请稍后重试。')
        }
        setMessage('')
        setStatus('error')
        return
      }

      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as ApiError
        setError(payload?.error ?? '未获取到分析结果。')
        setMessage('')
        setStatus('error')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      const filename =
        parseContentDisposition(disposition) ?? `${selectedFile.name.replace(/\.[^/.]+$/, '') || '12345台账'}-分析结果.xlsx`

      const objectUrl = URL.createObjectURL(blob)
      setDownloadUrl(objectUrl)

      const processed = parseHeaderNumber(response.headers.get('X-Analysis-Processed'))
      const unmatched = parseHeaderNumber(response.headers.get('X-Analysis-Unmatched'))
      const total = parseHeaderNumber(response.headers.get('X-Analysis-Total'))
      const breakdown = parseBreakdownHeader(response.headers.get('X-Analysis-Breakdown'))

      setStats({ processed, unmatched, total, filename, breakdown })
      setMessage('分析完成，可下载报表查看详细数据。')
      setStatus('success')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Failed to request ledger analysis', err)
      setError('网络异常，无法完成分析，请稍后重试。')
      setMessage('')
      setStatus('error')
    }
  }

  const handleResetSelection = () => {
    setSelectedFile(null)
    setStatus('idle')
    resetResults()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <motion.div
      className="rounded-3xl bg-slate-950/70 p-8 shadow-2xl backdrop-blur"
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-white">12345 台账分析</h2>
            <p className="text-white/70">
              上传台账 Excel 或 CSV 文件，系统将自动识别“答复内容”中的关键信息，归类权属部门并生成包含“分析结果”“部门分析”“未匹配”三张工作表的报表。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
            <p className="font-semibold text-white">使用说明</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>文件需包含“答复内容”列，建议使用 UTF-8 编码。</li>
              <li>权属部门会根据关键词与正则规则自动匹配，并统计数量与占比。</li>
              <li>未成功匹配的条目会保存在“未匹配”工作表中，方便人工复核。</li>
            </ul>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/10 px-6 py-10 text-center text-white/80 transition hover:border-white/40 hover:bg-white/20">
                <span className="text-lg font-medium">点击或拖拽文件到此处</span>
                <span className="mt-2 text-sm text-white/60">{helperText}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_FILE_TYPES}
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="rounded-full bg-sky-400 px-6 py-3 text-base font-semibold text-slate-900 transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-sky-400/60"
              >
                {isUploading ? '分析中…' : '开始分析'}
              </button>
              {selectedFile && !isUploading ? (
                <button
                  type="button"
                  onClick={handleResetSelection}
                  className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white/80 transition hover:bg-white/10"
                >
                  重新选择
                </button>
              ) : null}
            </div>
          </form>
        </div>
        <div className="flex-1">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  当前状态
                  <span className="ml-2">
                    {status === 'uploading'
                      ? '分析中…'
                      : status === 'success'
                      ? '分析完成'
                      : status === 'error'
                      ? '分析失败'
                      : '等待上传'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">分析总结</p>
                {stats ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div
                      className={[
                        'grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center',
                        'sm:grid-cols-3'
                      ].join(' ')}
                    >
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">已办理</p>
                        <p className="text-2xl font-semibold text-sky-200">
                          {stats.processed.toLocaleString()}
                          <span className="ml-1 text-sm font-medium">件</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">核实退回</p>
                        <p className="text-2xl font-semibold text-amber-200">
                          {stats.unmatched.toLocaleString()}
                          <span className="ml-1 text-sm font-medium">件</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">总计工单</p>
                        <p className="text-2xl font-semibold text-emerald-200">
                          {stats.total.toLocaleString()}
                          <span className="ml-1 text-sm font-medium">件</span>
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                      <p className="break-all">
                        导出文件：<span className="font-medium text-white/80">{stats.filename}</span>
                      </p>
                    </div>
                    {stats.breakdown.length > 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-white">部门分析</p>
                        <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/40">
                          <table className="min-w-full text-left text-xs text-white/80">
                            <thead className="sticky top-0 bg-slate-900/70 backdrop-blur">
                              <tr>
                                <th className="px-4 py-3 font-medium text-white/70">权属部门</th>
                                <th className="px-4 py-3 font-medium text-white/70 text-right">数量</th>
                                <th className="px-4 py-3 font-medium text-white/70 text-right">占比</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.breakdown.map((item) => (
                                <tr key={`${item.department}-${item.count}-${item.ratio || 'empty'}`} className="border-t border-white/5">
                                  <td className="px-4 py-2 font-medium text-white">{item.department}</td>
                                  <td className="px-4 py-2 text-right text-white/80">{item.count.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-white/60">{item.ratio || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/60">完成分析后将在此展示摘要数据。</p>
                )}
              </div>
              {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>
            <div className="mt-6">
              {stats && downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={stats.filename}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-400 px-5 py-3 text-base font-semibold text-slate-900 transition hover:scale-[1.02]"
                >
                  下载分析结果
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 3.5V10.5M8 10.5L5.5 8M8 10.5L10.5 8M4 12.5H12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ) : (
                <p className="text-xs text-white/50">完成分析后可下载分析报表。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
