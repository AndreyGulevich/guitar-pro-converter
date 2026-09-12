import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
function App() {
  const input = useRef(null), running = useRef(false);
  const [format, setFormat] = useState('midi'), [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('idle'), [result, setResult] = useState(null), [message, setMessage] = useState(''), [name, setName] = useState(''), [drag, setDrag] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  function reset() { setSelectedFile(null); setResult(null); setMessage(''); setProgress(null); setName(''); setStatus('idle'); }
  function choose(files) {
    if (running.current || !files?.length) return;
    setMessage('');
    if (files.length !== 1) { setMessage('Выберите один файл за раз.'); return; }
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) { setMessage('Файл слишком большой. Максимальный размер — 20 МБ.'); return; }
    setSelectedFile(file); setName(file.name); setResult(null); setProgress(null); setStatus('selected');
  }
  async function convert() {
    if (running.current || !selectedFile) return;
    const file = selectedFile;
    setMessage(''); setProgress(null);
    running.current = true; setStatus('busy');
    let worker;
    try {
      const bytes = await file.arrayBuffer();
      const converted = await new Promise((resolve, reject) => {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Обработка заняла слишком много времени. Проверьте файл.')); }, format === 'mp3' ? 20 * 60 * 1000 : 60000);
        worker.onmessage = ({ data }) => { if (data.progress) { setProgress(data.progress); return; } clearTimeout(timer); data.error ? reject(new Error(data.error)) : resolve(data.result); };
        worker.onerror = error => { console.error("Conversion worker failed", error.message); clearTimeout(timer); reject(new Error('Не удалось обработать файл. Попробуйте ещё раз.')); };
        worker.postMessage({ cmd: 'converter', bytes, name: file.name, format }, [bytes]);
      });
      setResult(converted); setStatus('ready');
    } catch (e) { setMessage(e.message || 'Не удалось открыть файл.'); setStatus('error'); }
    finally { worker?.terminate(); running.current = false; }
  }
  async function save() {
    setMessage('');
    try {
      if (window.desktop) {
        const saved = await window.desktop.saveFile(result.filename, result.bytes);
        if (saved) setMessage('Файл сохранён.');
      } else {
        const url = URL.createObjectURL(new Blob([result.bytes], { type: result.filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/midi' }));
        const a = document.createElement('a'); a.href = url; a.download = result.filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000); setMessage('Файл передан браузеру для скачивания.');
      }
    } catch { setMessage('Не удалось сохранить файл. Попробуйте выбрать другую папку.'); }
  }
  return <main>
    <section className={`panel workflow ${drag ? 'drag' : ''}`} onDragOver={e => { e.preventDefault(); if (status !== 'busy') setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files); }} aria-busy={status === 'busy'}>
      <input ref={input} type="file" accept=".gp3,.gp4,.gp5" aria-label="Файл Guitar Pro" onChange={e => { choose(e.target.files); e.target.value = ''; }} />
      {status === 'busy' ? <div role="status"><div className="spinner"/><h1>{format === 'mp3' ? 'Создаём MP3…' : 'Собираем MIDI…'}</h1><p className="filename">{name}</p><p>{progress ? `${progress.stage} · ${progress.percent}%` : 'Читаем файл…'}</p>{progress && <progress aria-label="Прогресс конвертации" max="100" value={progress.percent}/>}</div>
      : result ? <div><div className="file-icon">✓</div><h1>Файл готов</h1><p className="filename">{result.filename}</p><div className="action-row"><button onClick={save}>Скачать {format.toUpperCase()} <span>↓</span></button><button className="text-button" onClick={reset}>Начать заново</button></div></div>
      : selectedFile ? <div><h1>Выберите формат</h1><p className="filename">{name}</p><div className="action-row conversion-actions"><button className="text-button" onClick={() => input.current.click()}>Выбрать другой файл</button><select aria-label="Формат результата" value={format} onChange={e => { setFormat(e.target.value); setMessage(''); setStatus('selected'); }}><option value="midi">MIDI</option><option value="mp3">MP3</option></select><button onClick={convert}>Конвертировать</button></div></div>
      : <div><div className="file-icon">↥</div><h1>Выберите файл Guitar Pro</h1><p>Перетащите файл сюда или выберите на компьютере</p><button onClick={() => input.current.click()}>Выбрать файл <span>＋</span></button><div className="formats">GP3 · GP4 · GP5 / до 20 МБ</div></div>}
      {message && <p className={result ? 'notice' : 'error'} role={result ? 'status' : 'alert'}>{message}</p>}
    </section>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
