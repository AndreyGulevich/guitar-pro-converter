import { synth, midi } from '@coderline/alphatab';
import { Mp3Encoder } from '@breezystack/lamejs';
import { prepare } from './converter.js';
// No audio device is opened: only AlphaSynth's synchronous exporter runs in the worker.
function exporter(prepared, soundFont) {
  const event = { on() {}, off() {} };
  const output = { sampleRate: 44100, ready: event, sampleRequest: event, samplesPlayed: event, open() {}, destroy() {} };
  const engine = new synth.AlphaSynth(output, 100);
  const options = new synth.AudioExportOptions();
  options.soundFonts = [soundFont]; options.sampleRate = 44100; options.useSyncPoints = false;
  options.masterVolume = 1; options.metronomeVolume = 0;
  return engine.exportAudio(options, prepared.file, [], midi.MidiFileGenerator.buildTranspositionPitches(prepared.score, prepared.settings));
}
export function convertMp3(bytes, filename, soundFont, progress = () => {}) {
  const prepared = prepare(bytes, filename);
  // Synthesis consumes alphaTab's single-track event stream (including its effect events).
  const synthMidi = new midi.MidiFile();
  const generator = new midi.MidiFileGenerator(prepared.score, prepared.settings, new midi.AlphaSynthMidiFileHandler(synthMidi, false));
  generator.applyTranspositionPitches = false; // exporter applies the score's transposition once
  generator.generate();
  prepared.file = synthMidi;
  // Two passes avoid storing an entire song as PCM and preserve relative track levels.
  let renderer = exporter(prepared, soundFont), chunk, peak = 0, duration = 0;
  while ((chunk = renderer.render(1000))) {
    if (chunk.endTime > 30 * 60 * 1000) throw new Error('Для MP3 поддерживаются композиции до 30 минут. MIDI можно сохранить без этого ограничения.');
    for (const sample of chunk.samples) { if (!Number.isFinite(sample)) throw new Error('Ошибка синтеза аудио.'); peak = Math.max(peak, Math.abs(sample)); }
    duration += chunk.samples.length / 2 / 44100;
    progress({ stage: 'Анализ громкости', percent: Math.min(49, Math.round(chunk.currentTime / chunk.endTime * 49)) });
  }
  if (!peak) throw new Error('В композиции не найдено звучащих нот. Попробуйте сохранить MIDI.');
  // -6 dBFS ceiling leaves headroom for MP3 reconstruction overshoot.
  const gain = Math.min(1, 0.5 / peak), encoder = new Mp3Encoder(2, 44100, 192), parts = [];
  renderer = exporter(prepared, soundFont);
  while ((chunk = renderer.render(1000))) {
    const samples = chunk.samples;
    for (let offset = 0; offset < samples.length; offset += 2304) {
      const frames = Math.min(1152, (samples.length - offset) / 2), left = new Int16Array(frames), right = new Int16Array(frames);
      for (let i = 0; i < frames; i++) { left[i] = Math.round(samples[offset + i * 2] * gain * 32767); right[i] = Math.round(samples[offset + i * 2 + 1] * gain * 32767); }
      const part = encoder.encodeBuffer(left, right); if (part.length) parts.push(new Uint8Array(part));
    }
    progress({ stage: 'Кодирование MP3', percent: Math.min(99, 50 + Math.round(chunk.currentTime / chunk.endTime * 49)) });
  }
  parts.push(new Uint8Array(encoder.flush()));
  const output = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; }
  return { bytes: output, filename: prepared.filename.replace(/\.mid$/, '.mp3'), title: prepared.title, tracks: prepared.tracks, tempo: prepared.tempo, duration, peak, gain };
}
