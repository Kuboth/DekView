const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

// Servidor HTTP simples para servir a interface web do DekView
const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath);

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// Servidor WebSocket integrado na mesma porta (8080)
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`\n[+] Cliente receptor conectado de: ${remoteIp}`);

  // Simulação de geração de stream de vídeo de teste (1x1 pixel PNG ou JPEG simulado)
  // Em uma solução completa com driver (como spacedesk/IddSampleDriver), os frames de tela são enviados aqui
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', time: Date.now() }));
    }
  }, 3000);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'pointer_event') {
        const pType = data.pointerType;
        const pressureStr = (data.pressure > 0) ? `| Pressão: ${(data.pressure * 100).toFixed(1)}%` : '';
        const tiltStr = (data.tiltX || data.tiltY) ? `| Tilt: [${data.tiltX}°, ${data.tiltY}°]` : '';
        console.log(`[POINTER] Evento: ${data.event} | Tipo: ${pType.padEnd(5)} | Pos: (${data.x}, ${data.y}) [Norm: ${data.normX}, ${data.normY}] ${pressureStr} ${tiltStr}`);
      } else if (data.type === 'handshake') {
        console.log(`[HANDSHAKE] Cliente inicializado: Resolução: ${data.screenWidth}x${data.screenHeight} | DPR: ${data.devicePixelRatio} | MaxTouch: ${data.touchPoints}`);
      } else if (data.type === 'wheel_event') {
        console.log(`[WHEEL] Rolagem delta: (${data.deltaX}, ${data.deltaY})`);
      }
    } catch (e) {
      console.log(`[RAW DADOS]:`, message);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    console.log(`[-] Cliente desconectado (${remoteIp})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(`🚀 DekView Host Server rodando!`);
  console.log(`📌 Endereço local: http://${localIp}:${PORT}`);
  console.log(`📡 WebSocket ativo em: ws://${localIp}:${PORT}`);
  console.log(`=======================================================\n`);
  console.log(`Abra o DekView no Tablet/Celular e conecte em: ${localIp}:${PORT}\n`);
});
