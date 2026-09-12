import { convert } from './converter.js';
import { convertMp3 } from './audio.js';
import soundFontUrl from '@coderline/alphatab/soundfont/sonivox.sf2?url';
self.onmessage = async ({ data }) => {
  try {
    let result;
    if (data.format === 'mp3') {
      self.postMessage({ progress: { stage: 'Загрузка звукового банка (1,3 МБ)', percent: 0 } });
      const response = await fetch(soundFontUrl);
      if (!response.ok) throw new Error('Не удалось загрузить звуковой банк. Проверьте доступность файлов приложения.');
      const soundFont = new Uint8Array(await response.arrayBuffer());
      result = convertMp3(new Uint8Array(data.bytes), data.name, soundFont, progress => self.postMessage({ progress }));
    } else result = convert(new Uint8Array(data.bytes), data.name);
    self.postMessage({ result }, [result.bytes.buffer]);
  } catch (error) { self.postMessage({ error: error.message }); }
};
