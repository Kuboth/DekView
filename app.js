(() => {
  // Elementos da interface
  const setupOverlay = document.getElementById('setup-overlay');
  const hostInput = document.getElementById('host-input');
  const btnConnect = document.getElementById('btn-connect');
  const statusMsg = document.getElementById('status-msg');
  const displayContainer = document.getElementById('display-container');
  const streamVideo = document.getElementById('stream-video');
  const streamCanvas = document.getElementById('stream-canvas');
  const canvasCtx = streamCanvas.getContext('2d');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const infoBar = document.getElementById('info-bar');

  const protoOptions = document.querySelectorAll('.protocol-option');
  let selectedProto = 'ws'; // 'ws' ou 'webrtc'

  // Estado de conexão
  let socket = null;
  let peerConnection = null;
  let isConnected = false;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;

  // Seleção de protocolo
  protoOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      protoOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedProto = opt.dataset.proto;
    });
  });

  // Ajuste do Canvas para resolução real da tela
  function resizeCanvas() {
    streamCanvas.width = window.innerWidth;
    streamCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Solicitar Fullscreen
  async function enterFullscreen() {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) {
      console.warn('Fullscreen request bypassed:', err);
    }
  }

  // Conexão principal
  async function connect() {
    let host = hostInput.value.trim();
    if (!host) {
      statusMsg.textContent = 'Por favor, informe o IP ou host:porta.';
      statusMsg.style.color = '#ef4444';
      return;
    }

    if (!host.includes('://')) {
      host = `ws://${host}`;
    }

    statusMsg.textContent = 'Conectando ao host...';
    statusMsg.style.color = '#60a5fa';
    btnConnect.disabled = true;

    await enterFullscreen();

    if (selectedProto === 'ws') {
      connectWebSocket(host);
    } else {
      connectWebRTC(host);
    }
  }

  function handleConnectionSuccess() {
    isConnected = true;
    setupOverlay.classList.add('hidden');
    btnConnect.disabled = false;
    statusMsg.textContent = '';
    console.log('Conexão estabelecida com sucesso!');
  }

  function disconnect() {
    isConnected = false;
    if (socket) {
      socket.close();
      socket = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    setupOverlay.classList.remove('hidden');
    btnConnect.disabled = false;
    statusMsg.textContent = 'Desconectado.';
    statusMsg.style.color = '#94a3b8';
  }

  // --- WebSocket Stream Implementation ---
  function connectWebSocket(wsUrl) {
    try {
      socket = new WebSocket(wsUrl);
      socket.binaryType = 'blob';

      socket.onopen = () => {
        handleConnectionSuccess();
        sendClientHandshake();
      };

      socket.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch (e) {}
        } else if (event.data instanceof Blob) {
          // Renderização de quadros de vídeo (JPEG comprimido em tempo real)
          try {
            const bitmap = await createImageBitmap(event.data);
            canvasCtx.drawImage(bitmap, 0, 0, streamCanvas.width, streamCanvas.height);
            bitmap.close();
            calculateFps();
          } catch (err) {
            console.error('Erro renderizando quadro:', err);
          }
        }
      };

      socket.onerror = (e) => {
        console.error('Erro no WebSocket:', e);
        statusMsg.textContent = 'Erro ao conectar no WebSocket.';
        statusMsg.style.color = '#ef4444';
      };

      socket.onclose = () => {
        if (isConnected) {
          disconnect();
        }
      };
    } catch (err) {
      statusMsg.textContent = `Falha: ${err.message}`;
      statusMsg.style.color = '#ef4444';
      btnConnect.disabled = false;
    }
  }

  // --- WebRTC Implementation ---
  function connectWebRTC(signalUrl) {
    try {
      socket = new WebSocket(signalUrl);

      socket.onopen = () => {
        handleConnectionSuccess();
        setupPeerConnection();
      };

      socket.onmessage = async (event) => {
        if (typeof event.data !== 'string') return;
        const msg = JSON.parse(event.data);

        if (msg.sdp) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          if (msg.sdp.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.send(JSON.stringify({ sdp: peerConnection.localDescription }));
          }
        } else if (msg.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      };

      socket.onerror = () => {
        statusMsg.textContent = 'Erro de sinalização WebRTC.';
        statusMsg.style.color = '#ef4444';
      };

      socket.onclose = disconnect;
    } catch (err) {
      statusMsg.textContent = `Erro WebRTC: ${err.message}`;
      statusMsg.style.color = '#ef4444';
      btnConnect.disabled = false;
    }
  }

  function setupPeerConnection() {
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.ontrack = (event) => {
      streamVideo.style.display = 'block';
      streamCanvas.style.display = 'none';
      if (streamVideo.srcObject !== event.streams[0]) {
        streamVideo.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ candidate: event.candidate }));
      }
    };
  }

  function sendClientHandshake() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: 'handshake',
      client: 'dekview-receiver',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      supportsPointerEvents: window.PointerEvent !== undefined,
      touchPoints: navigator.maxTouchPoints || 0
    }));
  }

  // --- Captura de Eventos Pointer (Toque, Caneta, Clique) ---
  const pointerEvents = [
    'pointerdown',
    'pointerup',
    'pointermove',
    'pointercancel'
  ];

  function sendPointerEvent(e) {
    if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;

    // Normalização das coordenadas (0.0 até 1.0) para independência de resolução
    const rect = displayContainer.getBoundingClientRect();
    const normalizedX = (e.clientX - rect.left) / rect.width;
    const normalizedY = (e.clientY - rect.top) / rect.height;

    const payload = {
      type: 'pointer_event',
      event: e.type, // 'pointerdown', 'pointermove', 'pointerup', 'pointercancel'
      pointerId: e.pointerId,
      pointerType: e.pointerType, // 'mouse', 'touch', 'pen'
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      normX: parseFloat(normalizedX.toFixed(5)),
      normY: parseFloat(normalizedY.toFixed(5)),
      pressure: parseFloat(e.pressure.toFixed(4)), // Pressão (0.0 a 1.0) para caneta/toque
      tiltX: e.tiltX || 0, // Inclinação da caneta stylus
      tiltY: e.tiltY || 0,
      twist: e.twist || 0,
      button: e.button,
      buttons: e.buttons,
      isPrimary: e.isPrimary,
      timestamp: Date.now()
    };

    socket.send(JSON.stringify(payload));

    // Atualiza info bar com dados do ponteiro
    infoBar.textContent = `${e.pointerType.toUpperCase()} ID:${e.pointerId} [${payload.x}, ${payload.y}] P:${payload.pressure} | FPS: ${currentFps}`;
  }

  pointerEvents.forEach(evtName => {
    displayContainer.addEventListener(evtName, (e) => {
      e.preventDefault();
      sendPointerEvent(e);
    }, { passive: false });
  });

  // Suporte a roda de rolagem (Mouse Wheel)
  displayContainer.addEventListener('wheel', (e) => {
    if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: 'wheel_event',
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    }));
  }, { passive: true });

  // Cálculo de FPS
  function calculateFps() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
    }
  }

  // Listeners dos botões
  btnConnect.addEventListener('click', connect);
  btnFullscreen.addEventListener('click', enterFullscreen);
  btnDisconnect.addEventListener('click', disconnect);

  // Conexão rápida ao teclar Enter
  hostInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connect();
  });

  // --- Registro do Service Worker (PWA) e Instalação ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
      }).catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });
    });
  }

  // Prompt de Instalação PWA no Android/Tablet
  let deferredPrompt;
  const btnInstallApp = document.getElementById('btn-install-app');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallApp) {
      btnInstallApp.style.display = 'block';
      btnInstallApp.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] Escolha do usuário:', outcome);
        deferredPrompt = null;
        btnInstallApp.style.display = 'none';
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] DekView instalado com sucesso!');
    if (btnInstallApp) btnInstallApp.style.display = 'none';
  });
})();
