#!/usr/bin/env node
// Regenerates the spoken number clips in public/audio/numbers/ via Google
// Cloud Text-to-Speech, then trims each one with the same ffmpeg filter that
// cleaned up the existing clips, so a re-run never reintroduces the silence
// padding. Needed when a number is missing (see numbers/README.md for which
// ones exist) or the source recordings are lost.
//
// Setup: enable "Cloud Text-to-Speech API" in a Google Cloud project, create
// an API key, and put it in .env as GC_TEXT2SPEECH_API_KEY. Usage stays well
// inside the free monthly quota (a few hundred characters total).
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

process.loadEnvFile();

const API_KEY = process.env.GC_TEXT2SPEECH_API_KEY;
if (!API_KEY) {
  console.error('Missing GC_TEXT2SPEECH_API_KEY in .env');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve(import.meta.dirname, '../public/audio/numbers');
const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;

function range(start, end, step = 1) {
  const out = [];
  for (let n = start; n <= end; n += step) out.push(n);
  return out;
}

// 1-5, then every fifth number through 100. Matches "present so far" in
// numbers/README.md; extend this (and the README) together if more get added.
const NUMBERS = [...new Set([...range(1, 5), ...range(5, 100, 5)])].sort(
  (a, b) => a - b,
);

// Update in the Google Cloud Console if a voice name gets retired.
const VOICES = {
  de: { languageCode: 'de-DE', name: 'de-DE-Wavenet-B' },
  en: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
};

async function synthesize(number, lang) {
  const response = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: String(number) },
      voice: VOICES[lang],
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `TTS request failed for ${number}_${lang}: ${response.status} ${await response.text()}`,
    );
  }
  const { audioContent } = await response.json();
  return Buffer.from(audioContent, 'base64');
}

/**
 * Strips lead-in and trailing silence via ffmpeg's silenceremove, piped
 * in memory (no temp files). Thresholds match the one-off cleanup of the
 * existing clips: a short minimum for the leading cut, a longer one for the
 * trailing cut so it doesn't mistake the brief mid-word pause in compound
 * numbers ("fünfundzwanzig") for the trailing silence and chop the word.
 */
function trimSilence(inputBuffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i',
      'pipe:0',
      '-af',
      'silenceremove=start_periods=1:start_duration=0.08:start_threshold=-45dB:start_silence=0.03:detection=peak,' +
        'silenceremove=stop_periods=1:stop_duration=0.15:stop_threshold=-45dB:stop_silence=0.05:detection=peak',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '64k',
      '-f',
      'mp3',
      'pipe:1',
    ]);
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.stdin.end(inputBuffer);
  });
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const number of NUMBERS) {
    for (const lang of Object.keys(VOICES)) {
      const raw = await synthesize(number, lang);
      const trimmed = await trimSilence(raw);
      const filePath = path.join(OUTPUT_DIR, `${number}_${lang}.mp3`);
      await writeFile(filePath, trimmed);
      console.log(`done: ${filePath}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
