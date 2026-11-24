const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

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

// Servidor HTTP para servir a aplicação web
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath);

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png'
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

const wss = new WebSocketServer({ server });

let activeClients = new Set();
let isCapturing = false;

// Loop contínuo de captura e transmissão de tela
async function captureAndBroadcast() {
  if (activeClients.size === 0) {
    isCapturing = false;
    return;
  }

  try {
    // Detecta os monitores disponíveis
    const displays = await screenshot.listDisplays();
    // Se existir 2 ou mais telas, seleciona a segunda tela (virtual); caso contrário, a tela principal
    const targetDisplay = displays.length > 1 ? displays[1] : displays[0];

    // Captura o frame bruto da tela selecionada
    const imgBuffer = await screenshot({ screen: targetDisplay.id, format: 'jpeg' });

    // Otimiza e comprime rapidamente para envio leve via rede local
    const compressed = await sharp(imgBuffer)
      .jpeg({ quality: 65, mozjpeg: false })
      .toBuffer();

    for (const client of activeClients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(compressed);
      }
    }
  } catch (err) {
    // Erro comum caso a tela seja bloqueada temporariamente
  }

  // Agenda o próximo frame (visando ~30-40 FPS em rede local)
  setTimeout(captureAndBroadcast, 25);
}

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`\n[+] Cliente conectado: ${remoteIp}`);
  activeClients.add(ws);

  if (!isCapturing) {
    isCapturing = true;
    console.log(`[▶] Iniciando captura e transmissão de tela em tempo real...`);
    captureAndBroadcast();
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'pointer_event') {
        // Exibe no console a interação do tablet
        const pType = data.pointerType;
        const pressureStr = (data.pressure > 0) ? `| Pressão: ${(data.pressure * 100).toFixed(1)}%` : '';
        console.log(`[POINTER] ${data.event} | ${pType.padEnd(5)} | (${data.x}, ${data.y}) [Norm: ${data.normX}, ${data.normY}] ${pressureStr}`);
      } else if (data.type === 'handshake') {
        console.log(`[HANDSHAKE] Cliente inicializado: Resolução: ${data.screenWidth}x${data.screenHeight} | DPR: ${data.devicePixelRatio}`);
      }
    } catch (e) {
      // Ignora dados não-JSON
    }
  });

  ws.on('close', () => {
    activeClients.delete(ws);
    console.log(`[-] Cliente desconectado (${remoteIp}). Clientes ativos: ${activeClients.size}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(`🚀 DekView Host Server rodando com Captura em Tempo Real!`);
  console.log(`📌 Endereço local: http://${localIp}:${PORT}`);
  console.log(`📡 WebSocket ativo em: ws://${localIp}:${PORT}`);
  console.log(`=======================================================\n`);
  console.log(`Abra o DekView no Tablet/Celular e conecte em: ${localIp}:${PORT}\n`);
});
