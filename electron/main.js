const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { startServer, stopServer } = require('../server');

const SERVER_PORT = Number(process.env.PORT || 3000);
const SERVER_HOST = '127.0.0.1';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

let mainWindow = null;
let quitting = false;

async function createWindow() {
  startServer({ host: SERVER_HOST, port: SERVER_PORT });

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

  try {
    await mainWindow.loadURL(SERVER_URL);
  } catch (error) {
    dialog.showErrorBox(
      '起動エラー',
      `アプリの初期化に失敗しました。\n${error.message}`,
    );
    throw error;
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error('[electron] failed to create window:', error);
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await createWindow();
      } catch (error) {
        console.error('[electron] failed to recreate window:', error);
        app.quit();
      }
    }
  });
});

app.on('before-quit', async (event) => {
  if (quitting) return;

  event.preventDefault();
  quitting = true;

  try {
    await stopServer({ timeoutMs: 5000 });
  } catch (error) {
    console.error('[electron] failed to stop server cleanly:', error);
  }

  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
