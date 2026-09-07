/* Instrumentos e afinações. Cordas listadas da mais grave para a mais aguda.
   Notação científica: C4 = Dó central, A4 = 440 Hz (ajustável nas definições). */
'use strict';

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_NAMES_SOLFEGE_SHARP = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
const NOTE_NAMES_SOLFEGE_FLAT = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Sol♭', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];

/** "F#1" -> número MIDI (F#1 = 30). Aceita # e b. */
function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('Nota inválida: ' + name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (parseInt(m[3], 10) + 1) + base + acc;
}

function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

function freqToMidiFloat(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

function midiToName(midi, notation = 'latin', accidentals = 'sharp') {
  const idx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  let names;
  if (notation === 'solfege') names = accidentals === 'flat' ? NOTE_NAMES_SOLFEGE_FLAT : NOTE_NAMES_SOLFEGE_SHARP;
  else names = accidentals === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return { name: names[idx].replace('#', '♯').replace(/b$/, '♭'), octave, idx };
}

const T = (id, name, notes, desc, extra) => Object.assign({ id, name, notes, desc }, extra);

const INSTRUMENTS = [
  {
    id: 'guitar', name: 'Guitarra', icon: '🎸', desc: '6 cordas',
    tunings: [
      T('standard', 'Standard', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'E A D G B E'),
      T('drop-d', 'Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'D A D G B E'),
      T('double-drop-d', 'Double Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'D4'], 'D A D G B D'),
      T('half-down', 'Meio tom abaixo', ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'], 'E♭ A♭ D♭ G♭ B♭ E♭'),
      T('full-down', 'Um tom abaixo', ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'], 'D G C F A D'),
      T('drop-c', 'Drop C', ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'], 'C G C F A D'),
      T('drop-b', 'Drop B', ['B1', 'Gb2', 'B2', 'E3', 'Ab3', 'Db4'], 'B F♯ B E G♯ C♯'),
      T('drop-a', 'Drop A', ['A1', 'E2', 'A2', 'D3', 'Gb3', 'B3'], 'A E A D F♯ B'),
      T('dadgad', 'DADGAD', ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'], 'D A D G A D'),
      T('open-g', 'Open G', ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'], 'D G D G B D'),
      T('open-d', 'Open D', ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], 'D A D F♯ A D'),
      T('open-e', 'Open E', ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'], 'E B E G♯ B E'),
      T('open-c', 'Open C', ['C2', 'G2', 'C3', 'G3', 'C4', 'E4'], 'C G C G C E'),
      T('open-a', 'Open A', ['E2', 'A2', 'E3', 'A3', 'C#4', 'E4'], 'E A E A C♯ E'),
      T('c6', 'C6 (Hawaiana)', ['C2', 'A2', 'C3', 'G3', 'C4', 'E4'], 'C A C G C E'),
      T('new-standard', 'New Standard', ['C2', 'G2', 'D3', 'A3', 'E4', 'G4'], 'C G D A E G'),
      T('all-fourths', 'Quartas', ['E2', 'A2', 'D3', 'G3', 'C4', 'F4'], 'E A D G C F'),
      T('baritone-b', 'Barítono (B)', ['B1', 'E2', 'A2', 'D3', 'F#3', 'B3'], 'B E A D F♯ B'),
      T('baritone-a', 'Barítono (A)', ['A1', 'D2', 'G2', 'C3', 'E3', 'A3'], 'A D G C E A'),
      T('iris', 'Iris — Goo Goo Dolls', ['B1', 'D2', 'D3', 'D3', 'D4', 'D4'], 'B D D D D D', {
        song: true,
        warn: 'Afinação extrema. A corda mais grave desce 5 semitons até um Si muito grave (John Rzeznik usa uma corda .70) e a segunda mais aguda sobe 3 semitons, com risco de partir. Há duas cordas em Ré3 e duas em Ré4, em uníssono: usa o modo manual para as afinar.',
      }),
    ],
  },
  {
    id: 'guitar7', name: 'Guitarra 7 cordas', icon: '🎸', desc: '7 cordas',
    tunings: [
      T('standard', 'Standard', ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'B E A D G B E'),
      T('drop-a', 'Drop A', ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'A E A D G B E'),
      T('half-down', 'Meio tom abaixo', ['Bb1', 'Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'], 'B♭ E♭ A♭ D♭ G♭ B♭ E♭'),
      T('full-down', 'Um tom abaixo', ['A1', 'D2', 'G2', 'C3', 'F3', 'A3', 'D4'], 'A D G C F A D'),
      T('drop-g', 'Drop G', ['G1', 'D2', 'G2', 'C3', 'F3', 'A3', 'D4'], 'G D G C F A D'),
    ],
  },
  {
    id: 'guitar8', name: 'Guitarra 8 cordas', icon: '🎸', desc: '8 cordas',
    tunings: [
      T('standard', 'Standard', ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'F♯ B E A D G B E'),
      T('drop-e', 'Drop E', ['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'E B E A D G B E'),
      T('half-down', 'Meio tom abaixo', ['F1', 'Bb1', 'Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'], 'F B♭ E♭ A♭ D♭ G♭ B♭ E♭'),
    ],
  },
  {
    id: 'guitar12', name: 'Guitarra 12 cordas', icon: '🎸', desc: '6 pares',
    tunings: [
      T('standard', 'Standard', ['E2', 'E3', 'A2', 'A3', 'D3', 'D4', 'G3', 'G4', 'B3', 'B3', 'E4', 'E4'], 'Pares em oitava nas 4 graves'),
      T('half-down', 'Meio tom abaixo', ['Eb2', 'Eb3', 'Ab2', 'Ab3', 'Db3', 'Db4', 'Gb3', 'Gb4', 'Bb3', 'Bb3', 'Eb4', 'Eb4'], 'E♭ standard em pares'),
      T('full-down', 'Um tom abaixo', ['D2', 'D3', 'G2', 'G3', 'C3', 'C4', 'F3', 'F4', 'A3', 'A3', 'D4', 'D4'], 'D standard em pares'),
    ],
  },
  {
    id: 'classical', name: 'Guitarra clássica', icon: '🎸', desc: 'Cordas de nylon',
    tunings: [
      T('standard', 'Standard', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'E A D G B E'),
      T('drop-d', 'Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'D A D G B E'),
      T('renaissance', 'Alaúde renascentista', ['E2', 'A2', 'D3', 'F#3', 'B3', 'E4'], 'E A D F♯ B E'),
    ],
  },
  {
    id: 'bass', name: 'Baixo', icon: '🎸', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['E1', 'A1', 'D2', 'G2'], 'E A D G'),
      T('drop-d', 'Drop D', ['D1', 'A1', 'D2', 'G2'], 'D A D G'),
      T('half-down', 'Meio tom abaixo', ['Eb1', 'Ab1', 'Db2', 'Gb2'], 'E♭ A♭ D♭ G♭'),
      T('full-down', 'Um tom abaixo', ['D1', 'G1', 'C2', 'F2'], 'D G C F'),
      T('drop-c', 'Drop C', ['C1', 'G1', 'C2', 'F2'], 'C G C F'),
      T('bead', 'BEAD', ['B0', 'E1', 'A1', 'D2'], 'B E A D'),
      T('tenor', 'Tenor', ['A1', 'D2', 'G2', 'C3'], 'A D G C'),
      T('piccolo', 'Piccolo', ['E2', 'A2', 'D3', 'G3'], 'E A D G (oitava acima)'),
    ],
  },
  {
    id: 'bass5', name: 'Baixo 5 cordas', icon: '🎸', desc: '5 cordas',
    tunings: [
      T('standard', 'Standard (B grave)', ['B0', 'E1', 'A1', 'D2', 'G2'], 'B E A D G'),
      T('tenor', 'Tenor (C agudo)', ['E1', 'A1', 'D2', 'G2', 'C3'], 'E A D G C'),
      T('drop-a', 'Drop A', ['A0', 'E1', 'A1', 'D2', 'G2'], 'A E A D G'),
      T('half-down', 'Meio tom abaixo', ['Bb0', 'Eb1', 'Ab1', 'Db2', 'Gb2'], 'B♭ E♭ A♭ D♭ G♭'),
      T('full-down', 'Um tom abaixo', ['A0', 'D1', 'G1', 'C2', 'F2'], 'A D G C F'),
    ],
  },
  {
    id: 'bass6', name: 'Baixo 6 cordas', icon: '🎸', desc: '6 cordas',
    tunings: [
      T('standard', 'Standard', ['B0', 'E1', 'A1', 'D2', 'G2', 'C3'], 'B E A D G C'),
      T('half-down', 'Meio tom abaixo', ['Bb0', 'Eb1', 'Ab1', 'Db2', 'Gb2', 'B2'], 'B♭ E♭ A♭ D♭ G♭ B'),
      T('drop-a', 'Drop A', ['A0', 'E1', 'A1', 'D2', 'G2', 'C3'], 'A E A D G C'),
    ],
  },
  {
    id: 'ukulele', name: 'Ukulele', icon: '🪕', desc: 'Soprano, concerto e tenor',
    tunings: [
      T('standard', 'Standard (High G)', ['G4', 'C4', 'E4', 'A4'], 'G C E A'),
      T('low-g', 'Low G', ['G3', 'C4', 'E4', 'A4'], 'G C E A (G grave)'),
      T('d-tuning', 'Afinação em D', ['A4', 'D4', 'F#4', 'B4'], 'A D F♯ B'),
      T('baritone', 'Barítono', ['D3', 'G3', 'B3', 'E4'], 'D G B E'),
      T('slack-key', 'Slack Key', ['G4', 'C4', 'E4', 'G4'], 'G C E G'),
    ],
  },
  {
    id: 'cavaquinho', name: 'Cavaquinho', icon: '🪕', desc: 'Português e brasileiro',
    tunings: [
      T('natural', 'Natural (Ré Sol Si Ré)', ['D4', 'G4', 'B4', 'D5'], 'D G B D'),
      T('minho', 'Minhoto (Sol Sol Si Ré)', ['G4', 'G4', 'B4', 'D5'], 'G G B D'),
      T('brasil', 'Brasileiro (Ré Sol Si Ré)', ['D4', 'G4', 'B4', 'D5'], 'D G B D'),
      T('brasil-alt', 'Brasileiro (Ré Sol Si Mi)', ['D4', 'G4', 'B4', 'E5'], 'D G B E'),
      T('lisboa', 'Lisboa (Ré Lá Si Mi)', ['D4', 'A4', 'B4', 'E5'], 'D A B E'),
    ],
  },
  {
    id: 'guitarra-portuguesa', name: 'Guitarra portuguesa', icon: '🎶', desc: 'Lisboa e Coimbra',
    tunings: [
      T('lisboa', 'Lisboa', ['D3', 'A3', 'B3', 'E4', 'A4', 'B4'], 'D A B E A B'),
      T('coimbra', 'Coimbra', ['C3', 'G3', 'A3', 'D4', 'G4', 'A4'], 'C G A D G A'),
    ],
  },
  {
    id: 'mandolin', name: 'Bandolim', icon: '🪕', desc: '4 pares',
    tunings: [
      T('standard', 'Standard', ['G3', 'D4', 'A4', 'E5'], 'G D A E'),
      T('gdad', 'GDAD', ['G3', 'D4', 'A4', 'D5'], 'G D A D'),
      T('gdgd', 'Open G', ['G3', 'D4', 'G4', 'D5'], 'G D G D'),
    ],
  },
  {
    id: 'banjo', name: 'Banjo 5 cordas', icon: '🪕', desc: '5.ª corda aguda',
    tunings: [
      T('open-g', 'Open G', ['G4', 'D3', 'G3', 'B3', 'D4'], 'g D G B D'),
      T('double-c', 'Double C', ['G4', 'C3', 'G3', 'C4', 'D4'], 'g C G C D'),
      T('open-d', 'Open D', ['F#4', 'D3', 'F#3', 'A3', 'D4'], 'f♯ D F♯ A D'),
      T('modal', 'Sawmill (modal)', ['G4', 'D3', 'G3', 'C4', 'D4'], 'g D G C D'),
      T('drop-c', 'Drop C', ['G4', 'C3', 'G3', 'B3', 'D4'], 'g C G B D'),
    ],
  },
  {
    id: 'banjo4', name: 'Banjo tenor', icon: '🪕', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['C3', 'G3', 'D4', 'A4'], 'C G D A'),
      T('irish', 'Irlandês', ['G2', 'D3', 'A3', 'E4'], 'G D A E'),
      T('chicago', 'Chicago', ['D3', 'G3', 'B3', 'E4'], 'D G B E'),
    ],
  },
  {
    id: 'violin', name: 'Violino', icon: '🎻', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['G3', 'D4', 'A4', 'E5'], 'G D A E'),
    ],
  },
  {
    id: 'viola', name: 'Viola de arco', icon: '🎻', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['C3', 'G3', 'D4', 'A4'], 'C G D A'),
    ],
  },
  {
    id: 'cello', name: 'Violoncelo', icon: '🎻', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['C2', 'G2', 'D3', 'A3'], 'C G D A'),
    ],
  },
  {
    id: 'double-bass', name: 'Contrabaixo', icon: '🎻', desc: '4 cordas',
    tunings: [
      T('standard', 'Standard', ['E1', 'A1', 'D2', 'G2'], 'E A D G'),
      T('solo', 'Solo', ['F#1', 'B1', 'E2', 'A2'], 'F♯ B E A'),
      T('five', '5 cordas (B grave)', ['B0', 'E1', 'A1', 'D2', 'G2'], 'B E A D G'),
    ],
  },
  {
    id: 'charango', name: 'Charango', icon: '🪕', desc: '5 pares',
    tunings: [
      T('standard', 'Standard', ['G4', 'C5', 'E5', 'A4', 'E5'], 'G C E A E'),
    ],
  },
  {
    id: 'balalaika', name: 'Balalaika', icon: '🪕', desc: 'Prima',
    tunings: [
      T('standard', 'Standard', ['E4', 'E4', 'A4'], 'E E A'),
    ],
  },
];

const CUSTOM_STORAGE_KEY = 'afinador.custom.v1';

function loadCustomTunings() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveCustomTunings(list) {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
  } catch (e) { /* armazenamento indisponível */ }
}

function getInstrument(id) {
  return INSTRUMENTS.find((i) => i.id === id) || INSTRUMENTS[0];
}

/** Devolve todas as afinações (predefinidas + personalizadas) de um instrumento. */
function getTunings(instrumentId, custom) {
  const inst = getInstrument(instrumentId);
  const mine = (custom || []).filter((c) => c.instrumentId === instrumentId)
    .map((c) => ({ id: c.id, name: c.name, notes: c.notes, desc: c.notes.map((n) => n.replace('#', '♯').replace(/b(?=\d)/, '♭').replace(/\d/, '')).join(' '), custom: true }));
  return inst.tunings.concat(mine);
}

function getTuning(instrumentId, tuningId, custom) {
  const list = getTunings(instrumentId, custom);
  return list.find((t) => t.id === tuningId) || list[0];
}

if (typeof module !== 'undefined') {
  module.exports = { INSTRUMENTS, noteToMidi, midiToFreq, freqToMidiFloat, midiToName, getTunings, getTuning, getInstrument };
}
