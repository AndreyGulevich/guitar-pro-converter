import { Settings, importer, midi } from '@coderline/alphatab';
export const MAX_BYTES = 20 * 1024 * 1024;
export function prepare(bytes, filename = 'Композиция.gp5') {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error('Файл пуст. Выберите файл Guitar Pro.');
  if (bytes.length > MAX_BYTES) throw new Error('Файл слишком большой. Максимальный размер — 20 МБ.');
  const header = new TextDecoder('ascii').decode(bytes.subarray(1, 31));
  if (!/^FICHIER GUITAR PRO v[345]\.\d{2}/.test(header)) throw new Error('Нужен файл Guitar Pro 3, 4 или 5 (.gp3, .gp4, .gp5). Формат файла не распознан.');
  try {
    const settings = new Settings();
    settings.importer.encoding = 'windows-1251';
    const score = importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
    if (!score.tracks.length || !score.masterBars.length) throw new Error('Empty score');
    // GP can contain internal channels above 15. SMF stores only four channel bits;
    // allocate distinct channels to prevent instrument/controller collisions on export.
    const melodic = score.tracks.filter(t => !t.staves.some(s => s.isPercussion));
    if (melodic.length > 7) throw new RangeError('В первой версии поддерживается до 7 мелодических партий плюс ударные: каждой партии нужны два MIDI-канала для приёмов.');
    const channels = Array.from({ length: 16 }, (_, i) => i).filter(i => i !== 9);
    for (const track of score.tracks) if (!melodic.includes(track)) {
      track.playbackInfo.primaryChannel = 9; track.playbackInfo.secondaryChannel = 9;
    }
    for (const track of melodic) track.playbackInfo.primaryChannel = channels.shift();
    for (const track of melodic) track.playbackInfo.secondaryChannel = channels.shift() ?? track.playbackInfo.primaryChannel;
    const file = new midi.MidiFile();
    // Type 0 merges all parts by absolute tick, retaining their MIDI channels.
    file.format = midi.MidiFileFormat.SingleTrackMultiChannel;
    new midi.MidiFileGenerator(score, settings, new midi.AlphaSynthMidiFileHandler(file, true)).generate();
    const name = filename.replace(/^.*[/\\]/, '').replace(/\.[^.]*$/, '').replace(/[\x00-\x1f]/g, '').slice(0, 180) || 'Композиция';
    return { file, score, settings, bytes: file.toBinary(), filename: `${name}.mid`, title: score.title || name, tracks: score.tracks.map(t => t.name), tempo: score.tempo };
  } catch (error) {
    if (error instanceof RangeError && error.message.startsWith('В первой версии')) throw error;
    throw new Error('Не удалось прочитать композицию. Возможно, файл повреждён или содержит неподдерживаемые данные.', { cause: error });
  }
}

export function convert(bytes, filename) { const { file, score, settings, ...result } = prepare(bytes, filename); return result; }
