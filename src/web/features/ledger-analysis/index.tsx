import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { motion } from 'framer-motion'

const ACCEPT_FILE_TYPES = '.xlsx,.xls,.csv'

type AnalysisStatus = 'idle' | 'uploading' | 'success' | 'error'

type AnalysisStats = {
  processed: number
  unmatched: number
  total: number
  filename: string
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

export default function LedgerAnalysisFeature() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState<AnalysisStats>(null)

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
    setMessage('')
    setError('')
    setStats(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setError('请先选择需要分析的文件。')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setStatus('uploading')
    setError('')
    setMessage('')

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
        setStatus('error')
        return
      }

      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as ApiError
        setError(payload?.error ?? '未获取到分析结果。')
        setStatus('error')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      const filename =
        parseContentDisposition(disposition) ?? `${selectedFile.name.replace(/\.[^/.]+$/, '') || '12345台账'}-分析结果.xlsx`

      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(downloadUrl)

      const processed = parseHeaderNumber(response.headers.get('X-Analysis-Processed'))
      const unmatched = parseHeaderNumber(response.headers.get('X-Analysis-Unmatched'))
      const total = parseHeaderNumber(response.headers.get('X-Analysis-Total'))

      setStats({ processed, unmatched, total, filename })
      setMessage('分析完成，文件已下载。')
      setStatus('success')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Failed to request ledger analysis', err)
      setError('网络异常，无法完成分析，请稍后重试。')
      setStatus('error')
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
      <div className="space-y-6">
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
                onClick={() => {
                  setSelectedFile(null)
                  setStats(null)
                  setMessage('')
                  setError('')
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white/80 transition hover:bg-white/10"
              >
                重新选择
              </button>
            ) : null}
          </div>
        </form>
        {message ? <p className="text-green-300">{message}</p> : null}
        {error ? <p className="text-rose-300">{error}</p> : null}
        {stats ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80">
            <p className="text-lg font-semibold text-white">本次分析摘要</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                已匹配条目：<span className="font-semibold text-sky-200">{stats.processed}</span>
              </li>
              <li>
                未匹配条目：<span className="font-semibold text-amber-200">{stats.unmatched}</span>
              </li>
              <li>
                总计条目数：<span className="font-semibold text-emerald-200">{stats.total}</span>
              </li>
              <li className="break-all text-xs text-white/60">导出文件：{stats.filename}</li>
            </ul>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
