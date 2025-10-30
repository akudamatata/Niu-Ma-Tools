import { useCallback } from 'react'
import { useConversionStore } from '../../store/useConversionStore'

export function useConvert() {
  const status = useConversionStore((state) => state.status)
  const result = useConversionStore((state) => state.result)
  const error = useConversionStore((state) => state.error)
  const convert = useConversionStore((state) => state.convert)
  const reset = useConversionStore((state) => state.reset)

  const handleConvert = useCallback(
    async (file: File, bitrate: string) => {
      await convert(file, bitrate)
    },
    [convert]
  )

  return {
    status,
    result,
    error,
    convert: handleConvert,
    reset
  }
}
