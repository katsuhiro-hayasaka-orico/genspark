const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { startServer, stopServer } = require('../server');

const SERVER_PORT = Number(process.env.PORT || 3000);
const SERVER_HOST = '127.0.0.1';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

let mainWindow = null;
let quitting = false;

function sanitizeExportFileNamePart(value) {
  return String(value || '画面')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || '画面';
}

function normalizeTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function defaultExportFileName({ screenName, format, timestamp }) {
  const ext = format === 'html' ? 'html' : format === 'png' ? 'png' : 'pdf';
  return `IT予実績管理ダッシュボード_${sanitizeExportFileNamePart(screenName)}_${normalizeTimestamp(timestamp)}.${ext}`;
}

async function chooseExportPath(window, { screenName, format, timestamp }) {
  const ext = format === 'html' ? 'html' : format === 'png' ? 'png' : 'pdf';
  const filters = {
    pdf: [{ name: 'PDFファイル', extensions: ['pdf'] }],
    html: [{ name: 'HTMLファイル', extensions: ['html'] }],
    png: [{ name: 'PNG画像', extensions: ['png'] }],
  };
  const result = await dialog.showSaveDialog(window, {
    title: `${ext.toUpperCase()}として保存`,
    defaultPath: defaultExportFileName({ screenName, format: ext, timestamp }),
    filters: filters[ext],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  return { canceled: false, filePath: result.filePath };
}

ipcMain.handle('export:pdf', async (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('出力対象の画面が見つかりません。');
  const save = await chooseExportPath(window, { ...options, format: 'pdf' });
  if (save.canceled) return { canceled: true };
  const pdf = await window.webContents.printToPDF({
    printBackground: true,
    landscape: options.orientation !== 'portrait',
    pageSize: 'A4',
    margins: { marginType: 'default' },
    preferCSSPageSize: true,
  });
  await fs.writeFile(save.filePath, pdf);
  return { canceled: false, filePath: save.filePath };
});

ipcMain.handle('export:html', async (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('出力対象の画面が見つかりません。');
  const save = await chooseExportPath(window, { ...options, format: 'html' });
  if (save.canceled) return { canceled: true };
  await fs.writeFile(save.filePath, String(options.html || ''), 'utf8');
  return { canceled: false, filePath: save.filePath };
});

ipcMain.handle('export:png', async (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('出力対象の画面が見つかりません。');
  const save = await chooseExportPath(window, { ...options, format: 'png' });
  if (save.canceled) return { canceled: true };
  const rect = options.rect && Number.isFinite(options.rect.width) && Number.isFinite(options.rect.height)
    ? {
        x: Math.max(0, Math.floor(options.rect.x || 0)),
        y: Math.max(0, Math.floor(options.rect.y || 0)),
        width: Math.max(1, Math.floor(options.rect.width)),
        height: Math.max(1, Math.floor(options.rect.height)),
      }
    : undefined;
  const image = await window.webContents.capturePage(rect);
  await fs.writeFile(save.filePath, image.toPNG());
  return { canceled: false, filePath: save.filePath };
});


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
