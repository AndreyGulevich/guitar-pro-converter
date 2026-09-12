import { chromium, _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseMidi } from 'midi-file';
import { midiDuration } from './midi-duration.mjs';
const electronMode = process.argv.includes('--electron');
const app = electronMode ? await electron.launch(process.env.APP_EXECUTABLE ? { executablePath:process.env.APP_EXECUTABLE, args:[] } : { args: ['.'] }) : null;
const browser = app ? null : await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = app ? await app.firstWindow() : await browser.newPage();
const durations = new Map();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await fs.mkdir('work', {recursive:true});
try {
  if (!app) await page.goto('http://127.0.0.1:4173');
  await page.getByRole('heading', {name:'Выберите файл Guitar Pro'}).waitFor();
  await page.screenshot({path:`work/${electronMode?'electron':'browser'}-initial.png`,fullPage:true});
  const files=['01 Герои (н).gp5','02 - Сумеем помочь (midi).gp5','03 Меч судьбы (н).gp5','06 Время вышло (н).gp5','Карфаген.gp4'];
  for (const [i,name] of files.entries()) {
    await page.locator('input[type=file]').setInputFiles(path.join(process.env.GP_SAMPLES_DIR || path.join(os.homedir(),'Downloads'),name));
    await page.getByRole('button',{name:'Конвертировать',exact:true}).click();
    await page.getByRole('button',{name:'Скачать MIDI'}).waitFor({timeout:60000});
    let saved;
    if (app) {
      saved=path.resolve(`work/electron-${i}.mid`);
      await app.evaluate(({dialog},filePath) => {dialog.showSaveDialog=async()=>({canceled:false,filePath});},saved);
      await page.getByRole('button',{name:'Скачать MIDI'}).click();
      await page.getByText('Файл сохранён.',{exact:true}).waitFor();
    } else {
      const dl=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать MIDI'}).click(); saved=await (await dl).path();
    }
    const midi = parseMidi(await fs.readFile(saved));
    assert.equal(midi.header.format,0); assert.equal(midi.tracks.length,1); durations.set(name,midiDuration(midi));
  }
  const selected=electronMode?[files[4]]:files;
  for (const [i,name] of selected.entries()) {
    await page.locator('input[type=file]').setInputFiles(path.join(process.env.GP_SAMPLES_DIR || path.join(os.homedir(),'Downloads'),name));
    await page.getByRole('combobox',{name:'Формат результата'}).selectOption('mp3');
    await page.getByRole('button',{name:'Конвертировать',exact:true}).click();
    await page.getByRole('button',{name:'Скачать MP3'}).waitFor({timeout:600000});
    let saved=path.resolve(`work/${electronMode?'electron':'browser'}-${i}.mp3`);
    if(app){await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},saved);await page.getByRole('button',{name:'Скачать MP3'}).click();await page.getByText('Файл сохранён.',{exact:true}).waitFor();}
    else{const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать MP3'}).click();await(await dl).saveAs(saved);}
    const data=await fs.readFile(saved);
    // Chromium's independent MP3 decoder verifies real audio, duration, finite samples and no clipping.
    const stats=await page.evaluate(async base64=>{
      const context=new AudioContext();try {const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const audio=await context.decodeAudioData(data.buffer);let peak=0,energy=0;
      for(let c=0;c<audio.numberOfChannels;c++){for(const sample of audio.getChannelData(c)){if(!Number.isFinite(sample))throw Error('nonfinite');peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}}
      return {duration:audio.duration,channels:audio.numberOfChannels,peak,energy};}finally{await context.close();}
    },data.toString('base64'));
    assert.ok(Math.abs(stats.duration-durations.get(name))<1, `MP3 and tempo-aware MIDI duration: ${stats.duration} vs ${durations.get(name)}`);
    assert.equal(stats.channels,2);assert.ok(stats.duration>30);assert.ok(stats.peak<1);assert.ok(stats.energy>1);
    console.log(JSON.stringify({mode:electronMode?'electron':'browser',name,bytes:data.length,...stats}));
  }
  await page.screenshot({path:`work/${electronMode?'electron':'browser'}-ready.png`,fullPage:true});
  await page.locator('input[type=file]').setInputFiles({name:'broken.gp5',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
  await page.getByRole('button',{name:'Конвертировать',exact:true}).click();
  await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/не распознан/);
  assert.deepEqual(errors,[]);
} catch(e) { console.log(await page.locator('body').innerText(),errors); await page.screenshot({path:'work/failure.png',fullPage:true}); throw e; } finally { if(app)await app.close();else await browser.close(); }
