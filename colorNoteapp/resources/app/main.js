const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 480,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    autoHideMenuBar: true
  });

  // Hide Electron's default native application menu.
  // The app has its own custom File/Edit/Format/View/Help bar in HTML.
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- Open a .txt file via native dialog ----
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Text File',
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

// ---- Save to an already-known file path ----
ipcMain.handle('file:save', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---- Save As: native save dialog then write file ----
ipcMain.handle('dialog:saveFileAs', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Text File',
    defaultPath: defaultName || 'Untitled.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { canceled: false, filePath: result.filePath };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});
