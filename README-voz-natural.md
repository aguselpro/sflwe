# Activar voz natural masculina

La voz por internet usa ElevenLabs. La clave se guarda en el servidor, nunca en `index.html`. ElevenLabs cobra el uso de texto a voz según el plan y los caracteres generados; revisa tu plan y pon un límite de crédito en la clave antes de compartir el servidor.

El servidor limita la generación local a 30 audios por hora por dispositivo. Úsalo en tu red de confianza; no publiques este servidor directamente en Internet sin añadir autenticación.

## Requisitos

- Node.js 18 o posterior.
- Una clave API de ElevenLabs con permiso de texto a voz.

## Iniciar en Windows PowerShell

Abre PowerShell en esta carpeta y ejecuta:

```powershell
$env:ELEVENLABS_API_KEY = "PEGA_TU_CLAVE_AQUI"
node server.mjs
```

En el mismo computador, abre `http://localhost:3000`. En el teléfono, conectado a la misma red Wi-Fi, abre `http://IP-DEL-COMPUTADOR:3000` (por ejemplo, `http://192.168.1.20:3000`). La voz por internet solo funciona mientras el servidor esté encendido.

El menú muestra voces masculinas en español disponibles para tu cuenta y pone primero las que indiquen acento chileno. Si ElevenLabs no ofrece una chilena para esa cuenta, podrás elegir otra voz masculina española.
