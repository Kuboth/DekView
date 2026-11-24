# DekView - Receptor de Segunda Tela (Web / WebSocket / WebRTC)

Aplicativo receptor de tela cheia inspirado na arquitetura de clientes de display remoto (como spacedesk), projetado para ser executado diretamente em qualquer navegador moderno (desktop, tablet, iPad, Android ou outro PC).

## 🚀 Funcionalidades

1. **Tela Inicial Minimalista:**
   - Permite informar o endereço do host (`localhost:8080` ou IP local como `192.168.x.x:8080`).
   - Seleção rápida de protocolo: **WebSocket Stream** ou **WebRTC**.
   - Ao clicar em **Conectar & Tela Cheia**, ativa o modo fullscreen automaticamente e inicia o fluxo.

2. **Exibição em Tela Cheia 100%:**
   - Renderização via `<canvas>` com `ImageBitmap` (para WebSocket com frames JPEG/WebP) e elemento `<video>` (para WebRTC via H.264/VP8/VP9).
   - `object-fit: fill` e resolução ajustada dinamicamente para cobrir 100% do display sem barras pretas ou rolagem.
   - HUD flutuante discreto com botões de alternância e métricas de FPS.

3. **Captura Completa de Entrada (Pointer Events):**
   - Suporte completo a **Toque (Touch)**, **Caneta Stylus (Pen)** e **Mouse**.
   - Captura eventos: `pointerdown`, `pointermove`, `pointerup` e `pointercancel`.
   - Propriedades transmitidas em tempo real via JSON:
     - `x`, `y` (coordenadas absolutas na janela)
     - `normX`, `normY` (coordenadas normalizadas entre `0.0` e `1.0` independentes de resolução)
     - `pressure` (intensidade da pressão de 0 a 1 para canetas com sensibilidade de pressão)
     - `tiltX`, `tiltY`, `twist` (graus de inclinação e rotação do stylus)
     - `pointerId`, `pointerType` (`touch`, `pen`, `mouse`)
     - `buttons`, `button`

---

## 🛠️ Como Executar

### 1. Iniciar o servidor host:
No diretório `dekview`:
```bash
node server.js
```
O servidor inicializará o serviço HTTP e o servidor WebSocket na porta `8080`.

### 2. Abrir o receptor:
- No próprio PC: acesse `http://localhost:8080`
- Em um tablet ou outro dispositivo na mesma rede Wi-Fi: acesse `http://[IP_DO_SEU_PC]:8080`

### 3. Conectar:
- Digite o IP e porta (ex: `192.168.1.15:8080` ou `localhost:8080`).
- Clique em **Conectar & Tela Cheia**.
- Toque, use a caneta ou movimente o mouse na tela receptora: as coordenadas e pressão aparecerão no log do console do servidor em tempo real.
