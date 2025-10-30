import { createFFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core-st/dist/ffmpeg-core.js?url'
import wasmURL from '@ffmpeg/core-st/dist/ffmpeg-core.wasm?url'
import workerURL from '@ffmpeg/core-st/dist/ffmpeg-core.worker.js?url'

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

const ffmpeg = createFFmpeg({
  log: true,
  corePath: coreURL,
  wasmPath: wasmURL,
  workerPath: workerURL
})

const loadPromise = ffmpeg.load()

ctx.onmessage = async (event: MessageEvent) => {
  const { id, fileData, inputName, bitrate } = event.data as {
    id: string
    fileData: ArrayBuffer
    inputName: string
    bitrate: string
  }

  try {
    await loadPromise

    const inputFile = 'input'
    const outputFile = 'output.mp3'

    ffmpeg.FS('writeFile', inputFile, new Uint8Array(fileData))
    await ffmpeg.run('-i', inputFile, '-b:a', bitrate, outputFile)
    const data = ffmpeg.FS('readFile', outputFile)

    ctx.postMessage(
      {
        id,
        status: 'success',
        payload: {
          buffer: data.buffer,
          inputName
        }
      },
      [data.buffer as ArrayBuffer]
    )

    ffmpeg.FS('unlink', inputFile)
    ffmpeg.FS('unlink', outputFile)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    ctx.postMessage({
      id,
      status: 'error',
      payload: {
        message
      }
    })
  }
}

export {}
