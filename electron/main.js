const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

const SERVER_PORT = Number(process.env.PORT || 3000);
const SERVER_HOST = '127.0.0.1';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

let mainWindow = null;
let serverProcess = null;
let shuttingDown = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(retries = 40, intervalMs = 250) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(`${SERVER_URL}/api/health`);
      if (response.ok) return;
    } catch (_) {
      // keep retrying until timeout
    }
    await wait(intervalMs);
  }
  throw new Error('Express server did not become ready in time.');
}

function startServer() {
  if (serverProcess) return;

  serverProcess = fork(path.join(__dirname, '..', 'server.js'), {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      HOST: SERVER_HOST,
      ELECTRON_RUN: '1',
    },
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[electron] server exited unexpectedly (code=${code}, signal=${signal})`);
      app.quit();
    }
    serverProcess = null;
  });
}

async function stopServer() {
  if (!serverProcess) return;
  shuttingDown = true;

  const child = serverProcess;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child && !child.killed) {
        child.kill('SIGKILL');
      }
    }, 3000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });

  serverProcess = null;
}

async function createWindow() {
  startServer();
  await waitForServerReady();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(SERVER_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('before-quit', async (event) => {
  if (!shuttingDown) {
    event.preventDefault();
    await stopServer();
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
