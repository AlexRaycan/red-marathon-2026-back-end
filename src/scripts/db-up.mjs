import { execSync, spawn } from 'node:child_process'
import { platform } from 'node:os'

const isDockerRunning = () => {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const startDocker = () => {
  const os = platform()

  if (os === 'darwin') {
    execSync('open -a Docker')
  } else if (os === 'win32') {
    spawn('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe', {
      detached: true,
      stdio: 'ignore'
    }).unref()
  } else {
    execSync(
      'systemctl --user start docker-desktop || sudo systemctl start docker',
      {
        stdio: 'inherit'
      }
    )
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

if (!isDockerRunning()) {
  console.log('Starting Docker...')
  startDocker()

  while (!isDockerRunning()) {
    await wait(1000)
  }
}

execSync('docker compose up -d', { stdio: 'inherit' })
