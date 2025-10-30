import { createFFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core-st/dist/ffmpeg-core.js?url'
import wasmURL from '@ffmpeg/core-st/dist/ffmpeg-core.wasm?url'
import workerURL from '@ffmpeg/core-st/dist/ffmpeg-core.worker.js?url'

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

const ffmpeg = createFFmpeg({
  log: true,
  mainName: 'main',
  corePath: coreURL,
  wasmPath: wasmURL,
  workerPath: workerURL
})

const loadPromise = ffmpeg.load()

type WorkerRequest = {
  id: string
  fileData: ArrayBuffer
  inputName: string
  bitrate: string
}

let commandQueue: Promise<void> = Promise.resolve()

async function processCommand({ id, fileData, inputName, bitrate }: WorkerRequest) {
  let inputFile = ''
  let outputFile = ''

  try {
    await loadPromise

    inputFile = `${id}-input`
    outputFile = `${id}-output.mp3`

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
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    ctx.postMessage({
      id,
      status: 'error',
      payload: {
        message
      }
    })
  } finally {
    try {
      if (inputFile) {
        ffmpeg.FS('unlink', inputFile)
      }
    } catch {
      // ignore cleanup errors
    }

    try {
      if (outputFile) {
        ffmpeg.FS('unlink', outputFile)
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const task = () => processCommand(event.data)
  commandQueue = commandQueue.then(task, task)
}

export {}
