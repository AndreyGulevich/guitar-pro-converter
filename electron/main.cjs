const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
let win;
const entry = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle('save-file', async (event, name, bytes) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== entry) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !(bytes instanceof Uint8Array) || bytes.length < 14 || bytes.length > 100 * 1024 * 1024) throw new Error('Invalid MIDI');
    const ext = name.endsWith('.mp3') ? 'mp3' : 'mid';
    if (ext === 'mid' && Buffer.from(bytes.subarray(0, 4)).toString() !== 'MThd') throw new Error('Invalid MIDI');
    if (ext === 'mp3' && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) throw new Error('Invalid MP3');
    const safeName = path.basename(name).replace(/[\x00-\x1f/:]/g, '_').replace(/\.(mid|mp3)$/i, '').slice(0, 180) + '.' + ext;
    const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: safeName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (canceled || !filePath) return false;
    // Same-directory temporary file makes replacement atomic; the native dialog confirms overwrite.
    const temp = `${filePath}.${require('node:crypto').randomUUID()}.tmp`;
    try { await fs.writeFile(temp, bytes, { flag: 'wx' }); await fs.rename(temp, filePath); }
    finally { await fs.unlink(temp).catch(() => {}); }
    return true;
  });
  function createWindow() {
    win = new BrowserWindow({ width: 900, height: 870, minWidth: 480, minHeight: 700, title: 'Guitar Pro конвертер', backgroundColor: '#f6f7f2', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    win.loadURL(entry);
  }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
