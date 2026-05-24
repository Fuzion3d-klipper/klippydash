# Cómo generar el KlipperDash.exe portable

## Requisitos (una sola vez)
- Node.js 18+ → https://nodejs.org (LTS, versión Windows)

## Pasos

```
1. Descomprimí este ZIP en cualquier carpeta
2. Abrí una terminal (cmd o PowerShell) en esa carpeta
3. Ejecutá:

   npm install
   npm run build:win

4. En la carpeta /dist/ aparece:
   KlipperDash-portable.exe   ← este es el ejecutable, copialo donde quieras
```

## El .exe portable
- No instala nada en el sistema
- Guarda la configuración en %APPDATA%\klipperdash
- No necesita Python, Node ni nada externo para ejecutarse
- Funciona en Windows 10/11 x64

## Desarrollo / modo browser
Si querés probar sin compilar, usá server.py como antes:
   python server.py
