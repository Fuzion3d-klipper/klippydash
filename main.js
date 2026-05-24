const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const net  = require('net');

let proxyServer, mainWindow, proxyPort;

// ── SERVIDOR: sirve index.html + hace proxy a Moonraker ───────────────────
function startServer(port) {
  const indexPath = path.join(__dirname, 'index.html');

  proxyServer = http.createServer((req, res) => {

    // ── 1. Proxy a Moonraker: /proxy/ip:puerto/ruta
    if (req.url.startsWith('/proxy/')) {
      const rest  = req.url.slice(7);                    // ip:port/ruta
      const slash = rest.indexOf('/');
      const host  = slash === -1 ? rest : rest.slice(0, slash);
      const tail  = slash === -1 ? '/'  : rest.slice(slash);
      const [hostname, portStr] = host.split(':');
      const targetPort = parseInt(portStr) || 80;

      const opts = {
        hostname, port: targetPort, path: tail,
        method: req.method,
        headers: { 'content-type': 'application/json' }
      };

      const body = [];
      req.on('data', c => body.push(c));
      req.on('end', () => {
        const pr = http.request(opts, pRes => {
          res.writeHead(pRes.statusCode, {
            'content-type': pRes.headers['content-type'] || 'application/json',
            'access-control-allow-origin': '*'
          });
          pRes.pipe(res);
        });
        pr.on('error', e => {
          res.writeHead(502, { 'access-control-allow-origin': '*' });
          res.end(JSON.stringify({ error: e.message }));
        });
        if (body.length) pr.write(Buffer.concat(body));
        pr.end();
      });
      return;
    }

    // ── 2. OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type'
      });
      res.end();
      return;
    }

    // ── 3. Servir index.html para cualquier otra ruta
      // ── 3. Servir archivos estáticos

    let reqPath = req.url === '/' ? 'index.html' : req.url;

    if (reqPath.startsWith('/')) {
      reqPath = reqPath.slice(1);
    }

    let filePath = path.join(__dirname, reqPath);

    fs.readFile(filePath, (err, data) => {

      // Si no existe, volver al index
      if (err) {

        fs.readFile(indexPath, (err2, indexData) => {

          if (err2) {
            res.writeHead(500);
            res.end('Error');
            return;
          }

          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });

          res.end(indexData);
        });

        return;
      }

      // MIME types
      const ext = path.extname(filePath).toLowerCase();

      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };

      res.writeHead(200, {
        'content-type': mime[ext] || 'application/octet-stream'
      });

      res.end(data);
    });
  });

  proxyServer.listen(port);
}

function findFreePort(start = 49200) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(start, () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', () => resolve(findFreePort(start + 1)));
  });
}

// ── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
function loadConfig() {
  try { if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch(e) {}
  return { windowBounds: null };
}
function saveConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2)); }
let config = loadConfig();

// ── VENTANA ────────────────────────────────────────────────────────────────
async function createWindow() {
  proxyPort = await findFreePort();
  startServer(proxyPort);

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const bounds = config.windowBounds || { width, height, x: 0, y: 0 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900, minHeight: 600,
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#080810',
    autoHideMenuBar: true,   // ocultar barra File/Edit/View/Window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false); // asegurar que no aparezca

  // Cargar desde http://localhost — así fetch() funciona sin restricciones
  mainWindow.loadURL(`http://localhost:${proxyPort}`);

  mainWindow.on('close', () => { config.windowBounds = mainWindow.getBounds(); saveConfig(config); });
}

Menu.setApplicationMenu(null); // eliminar menú nativo completamente
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => proxyServer?.close());

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.handle('win-minimize',   () => mainWindow.minimize());
ipcMain.handle('win-maximize',   () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('win-close',      () => mainWindow.close());
ipcMain.handle('win-fullscreen', () => mainWindow.setFullScreen(!mainWindow.isFullScreen()));
ipcMain.handle('get-proxy-port', () => proxyPort);
