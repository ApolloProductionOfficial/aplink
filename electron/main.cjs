const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Оптимизации GPU/CPU
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let mainWindow = null;
let splashWindow = null;
let mainShown = false;

const LOCAL_INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const SPLASH_PATH = path.join(__dirname, 'splash.html');
const APP_ICON_PATH = path.join(__dirname, 'assets', 'aplink-logo.png');
const FALLBACK_WEB_URL = 'https://aplink.live';

function getWindowIcon() {
  return fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined;
}

function showMainWindow() {
  if (!mainWindow || mainShown) return;
  mainShown = true;

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }

  mainWindow.show();
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 520,
    frame: false,
    transparent: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#020817',
    icon: getWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  splashWindow.loadFile(SPLASH_PATH).catch((error) => {
    console.error('[electron] splash load failed:', error);
  });

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function loadMainContent() {
  if (!mainWindow) return;

  const loadLocalApp = () => {
    if (!fs.existsSync(LOCAL_INDEX_PATH)) {
      throw new Error(`Missing file: ${LOCAL_INDEX_PATH}`);
    }

    return mainWindow.loadFile(LOCAL_INDEX_PATH);
  };

  loadLocalApp().catch((error) => {
    console.error('[electron] local index failed, switching to web:', error);
    return mainWindow?.loadURL(FALLBACK_WEB_URL);
  }).catch((error) => {
    console.error('[electron] fallback web load failed:', error);
  });
}

function createWindow() {
  mainShown = false;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'APLink',
    backgroundColor: '#020817',
    icon: getWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  const revealTimeout = setTimeout(() => {
    if (!mainShown) {
      console.warn('[electron] force showing main window after timeout');
      showMainWindow();
    }
  }, 15000);

  mainWindow.webContents.once('did-finish-load', () => {
    clearTimeout(revealTimeout);
    showMainWindow();
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, message, validatedURL) => {
    console.error('[electron] did-fail-load:', { code, message, validatedURL });
    if (validatedURL && validatedURL.startsWith('file://')) {
      mainWindow?.loadURL(FALLBACK_WEB_URL).catch((error) => {
        console.error('[electron] failed to open fallback URL:', error);
      });
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[electron] render-process-gone:', details);
    mainWindow?.loadURL(FALLBACK_WEB_URL).catch((error) => {
      console.error('[electron] failed recovery load:', error);
    });
  });

  loadMainContent();

  mainWindow.on('closed', () => {
    clearTimeout(revealTimeout);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && fs.existsSync(APP_ICON_PATH) && app.dock?.setIcon) {
    app.dock.setIcon(APP_ICON_PATH);
  }

  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
