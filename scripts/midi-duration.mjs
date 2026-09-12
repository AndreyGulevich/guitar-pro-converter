export function midiDuration(midi) {
  const events = midi.tracks.flatMap(track => { let tick=0; return track.map(event => ({...event,tick:tick+=event.deltaTime})); }).sort((a,b)=>a.tick-b.tick);
  let tick=0, seconds=0, tempo=500000;
  for(const event of events){seconds+=(event.tick-tick)*tempo/1000000/midi.header.ticksPerBeat;tick=event.tick;if(event.type==='setTempo')tempo=event.microsecondsPerBeat;}
  return seconds;
}
