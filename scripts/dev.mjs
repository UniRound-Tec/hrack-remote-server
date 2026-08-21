/**
 * 平台开发编排：同时拉起 relay（tsx，默认 :3001 需自配端口/env）与 web（next dev）。
 * 用法：
 *   npm run dev            # 两个都起
 *   npm run dev -- --only web|relay
 * 端口默认：web 3000（spec §4），可用 WEB_PORT 覆盖；relay 由其自身 env 决定。
 * Ctrl+C 会同时收掉两个子进程。
 */
import { spawn } from 'node:child_process'

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : undefined

const jobs = []
if (!only || only === 'web') {
  jobs.push({
    name: 'web',
    cwd: 'web',
    env: { ...process.env, PORT: process.env.WEB_PORT ?? '3000' }
  })
}
if (!only || only === 'relay') {
  jobs.push({ name: 'relay', cwd: 'relay', env: { ...process.env } })
}

const npm = process.platform === 'win32' ? 'npm' : 'npm'
const children = []

for (const job of jobs) {
  // Windows: .cmd 必须经 shell 启动（Node 安全补丁禁了无 shell 的 .cmd spawn）
  const child = spawn(npm, ['run', 'dev'], {
    cwd: job.cwd,
    env: job.env,
    shell: process.platform === 'win32'
  })
  children.push(child)
  const tag = `\x1b[90m[${job.name}]\x1b[0m `
  const pipe = (stream, isError) => {
    stream.setEncoding('utf8')
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        process[isError ? 'stderr' : 'stdout'].write(
          `${tag}${isError ? '\x1b[33m' : ''}${line}\x1b[0m`
        )
      }
    })
  }
  pipe(child.stdout, false)
  pipe(child.stderr, true)
  child.on('exit', (code) => {
    process.stderr.write(`${tag}exited with code ${code}\n`)
  })
}

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
