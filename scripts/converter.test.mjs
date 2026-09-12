import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { midi } from '@coderline/alphatab';
import { parseMidi } from 'midi-file';
import { prepare, convert } from '../src/converter.js';
const names = ['01 Герои (н).gp5', '02 - Сумеем помочь (midi).gp5', '03 Меч судьбы (н).gp5', '06 Время вышло (н).gp5', 'Карфаген.gp4'];
export const files = names.map(n => path.join(process.env.GP_SAMPLES_DIR || path.join(os.homedir(), 'Downloads'), n));
const counts = [8, 5, 8, 8, 6];
for (const [i, file] of files.entries()) test(names[i], () => {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const { score, settings, ...result } = prepare(bytes, names[i]);
  const parsed = parseMidi(result.bytes);
  assert.equal(parsed.header.format, 0); assert.equal(parsed.tracks.length, 1); assert.equal(score.tracks.length, counts[i]);
  for (const [j, events] of parsed.tracks.entries()) {
    assert.ok(events.some(e => e.type === 'noteOn' && e.velocity > 0), `track ${j} notes`);
    assert.ok(events.every(e => e.deltaTime >= 0));
    assert.ok(events.some(e => e.type === 'endOfTrack'));
  }
  for (const track of score.tracks) {
    const info = track.playbackInfo;
    const channelEvents = parsed.tracks.flat().filter(e => e.channel === info.primaryChannel);
    assert.ok(channelEvents.some(e => e.type === 'programChange' && e.programNumber === info.program));
    for (const [controller, value] of [[7, info.volume], [10, info.balance]]) {
      assert.ok(channelEvents.some(e => e.type === 'controller' && e.controllerType === controller && e.value === Math.min(127, value * 8)), `controller ${controller}`);
    }
  }
  // Independent parser compares every event and its absolute tick to the former
  // multi-track export: merging must not drop notes, effects, tempo or channels.
  const reference = new midi.MidiFile();
  reference.format = midi.MidiFileFormat.MultiTrack;
  new midi.MidiFileGenerator(score, settings, new midi.AlphaSynthMidiFileHandler(reference, true)).generate();
  const original = parseMidi(reference.toBinary());
  function timedEvents(file) {
    return file.tracks.flatMap(events => {
      let tick = 0;
      return events.map(({deltaTime, ...event}) => { tick += deltaTime; return {tick, ...event}; });
    });
  }
  const mergedEvents = timedEvents(parsed), originalEvents = timedEvents(original);
  const musical = events => events.filter(e => e.type !== 'endOfTrack').map(e => JSON.stringify(e)).sort();
  assert.equal(parsed.header.ticksPerBeat, original.header.ticksPerBeat);
  assert.deepEqual(musical(mergedEvents), musical(originalEvents));
  assert.equal(mergedEvents.filter(e => e.type === 'endOfTrack').length, 1);
  assert.equal(mergedEvents.at(-1).type, 'endOfTrack');
  assert.equal(mergedEvents.at(-1).tick, Math.max(...originalEvents.map(e => e.tick)));
  const tempos = parsed.tracks.flat().filter(e => e.type === 'setTempo');
  assert.ok(tempos.some(e => Math.abs(60000000/e.microsecondsPerBeat - score.tempo) < .01));
  for (const bar of score.masterBars) for (const tempo of bar.tempoAutomations) assert.ok(tempos.some(e => Math.abs(60000000/e.microsecondsPerBeat - tempo.value) < .02));
  console.log(JSON.stringify({ file: names[i], tracks: parsed.tracks.length, tempo: score.tempo, tempoEvents: tempos.length }));
});
test('invalid, empty, truncated and oversized data', () => {
  assert.throws(() => convert(new Uint8Array()), /пуст/);
  assert.throws(() => convert(new Uint8Array([1,2,3])), /не распознан/);
  assert.throws(() => convert(new Uint8Array(21 * 1024 * 1024)), /большой/);
  const sample = new Uint8Array(fs.readFileSync(files[0]));
  assert.throws(() => convert(sample.subarray(0, 80)), /повреждён/);
});
