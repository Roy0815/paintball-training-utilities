#!/usr/bin/env node
// Wraps `cloudflared tunnel` so the printed https://*.trycloudflare.com URL
// also shows up as a scannable QR code instead of having to be typed into a
// phone. Needed when the dev machine runs WSL2, whose NAT network makes the
// dev server unreachable from other devices on the same Wi-Fi.
import { spawn } from 'node:child_process';
import qrcode from 'qrcode-terminal';

const child = spawn('cloudflared', ['tunnel', '--url', 'https://localhost:5173', '--no-tls-verify'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
let qrPrinted = false;

// cloudflared prints the tunnel URL once, on either stream, mixed into its
// normal log output. Everything is passed through unchanged so the tunnel's
// own messages stay visible.
function handleChunk(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  if (qrPrinted) return;
  const match = text.match(urlPattern);
  if (!match) return;
  qrPrinted = true;
  console.log(`\nOpen on your phone: ${match[0]}\n`);
  qrcode.generate(match[0], { small: true });
}

child.stdout.on('data', handleChunk);
child.stderr.on('data', handleChunk);

child.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
