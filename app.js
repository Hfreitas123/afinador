/* Afinador — lógica da aplicação */
'use strict';

(function () {
  const VERSION = '1.0.2';
  const $ = (sel) => document.querySelector(sel);

  /* ---------- Estado ---------- */
  const DEFAULT_SETTINGS = {
    a4: 440, transpose: 0, sensitivity: 60, tolerance: 3,
    notation: 'latin', accidentals: 'sharp', theme: 'dark', wakeLock: true, ding: false,
  };
  const state = {
    instrumentId: 'guitar',
    tuningId: 'standard',
    selectedString: null,     // null = automático
    custom: loadCustomTunings(),
    settings: { ...DEFAULT_SETTINGS },
    running: false,
    tunedFlags: [],
  };

  try {
    const s = JSON.parse(localStorage.getItem('afinador.settings.v1') || '{}');
    Object.assign(state.settings, s);
    const last = JSON.parse(localStorage.getItem('afinador.last.v1') || '{}');
    if (last.instrumentId) state.instrumentId = last.instrumentId;
    if (last.tuningId) state.tuningId = last.tuningId;
  } catch (e) { /* ignorar */ }

  function persist() {
    try {
      localStorage.setItem('afinador.settings.v1', JSON.stringify(state.settings));
      localStorage.setItem('afinador.last.v1', JSON.stringify({ instrumentId: state.instrumentId, tuningId: state.tuningId }));
    } catch (e) { /* ignorar */ }
  }

  function currentTuning() {
    const t = getTuning(state.instrumentId, state.tuningId, state.custom);
    if (t.id !== state.tuningId) state.tuningId = t.id;
    return t;
  }

  /** Cordas-alvo: [{midi, freq, label, octave}] com transposição aplicada. */
  function targets() {
    const t = currentTuning();
    return t.notes.map((n) => {
      const midi = noteToMidi(n) + state.settings.transpose;
      const nm = midiToName(midi, state.settings.notation, state.settings.accidentals);
      return { midi, freq: midiToFreq(midi, state.settings.a4), label: nm.name, octave: nm.octave };
    });
  }

  /* ---------- Tema ---------- */
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const th = state.settings.theme;
    const light = th === 'light' || (th === 'auto' && mq.matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = light ? '#f3f5f9' : '#0f1420';
  }
  mq.addEventListener?.('change', applyTheme);

  /* ---------- Medidor (gauge) ---------- */
  const CX = 160, CY = 170, R = 130, MAX_ANGLE = 80; // ±50 cents -> ±80°
  const centsToAngle = (c) => Math.max(-50, Math.min(50, c)) / 50 * MAX_ANGLE;
  const polar = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  function buildTicks() {
    const g = $('#ticks');
    let html = '';
    for (let c = -50; c <= 50; c += 5) {
      const major = c % 10 === 0;
      const a = centsToAngle(c);
      const [x1, y1] = polar(118, a);
      const [x2, y2] = polar(major ? 104 : 110, a);
      html += `<line class="${major ? 'major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    g.innerHTML = html;
  }
  function drawOkArc() {
    const tol = state.settings.tolerance;
    const [x1, y1] = polar(R, centsToAngle(-tol));
    const [x2, y2] = polar(R, centsToAngle(tol));
    $('#arc-ok').setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }

  /* ---------- Histórico ---------- */
  const history = [];  // cents ou null
  const HISTORY_LEN = 160;
  const canvas = $('#history');
  const ctx = canvas.getContext('2d');
  function pushHistory(v) {
    history.push(v);
    if (history.length > HISTORY_LEN) history.shift();
  }
  function drawHistory() {
    const w = canvas.width, h = canvas.height;
    const css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, w, h);
    const tol = state.settings.tolerance;
    const yOf = (c) => h / 2 - Math.max(-50, Math.min(50, c)) / 50 * (h / 2 - 4);
    ctx.fillStyle = css.getPropertyValue('--ok').trim();
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, yOf(tol), w, yOf(-tol) - yOf(tol));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = css.getPropertyValue('--line').trim();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.strokeStyle = css.getPropertyValue('--accent').trim();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    let pen = false;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const v = history[i];
      const x = w - (history.length - 1 - i) * (w / HISTORY_LEN);
      if (v === null) { pen = false; continue; }
      if (!pen) { ctx.moveTo(x, yOf(v)); pen = true; } else ctx.lineTo(x, yOf(v));
    }
    ctx.stroke();
  }

  /* ---------- Render principal ---------- */
  function renderHeader() {
    const inst = getInstrument(state.instrumentId);
    const t = currentTuning();
    $('#instrument-icon').textContent = inst.icon;
    $('#instrument-name').textContent = inst.name;
    $('#tuning-name').textContent = t.name + (state.settings.transpose ? ` (${state.settings.transpose > 0 ? '+' : ''}${state.settings.transpose})` : '');
    const warnEl = $('#tuning-warn');
    warnEl.hidden = !t.warn;
    warnEl.classList.remove('open');
    if (t.warn) {
      // primeira frase sempre visível; o resto abre com "Ver mais"
      const cut = t.warn.indexOf('. ');
      const short = cut > 0 ? t.warn.slice(0, cut + 1) : t.warn;
      const rest = cut > 0 ? t.warn.slice(cut + 2) : '';
      $('#warn-short').textContent = '⚠︎ ' + short;
      $('#warn-full').textContent = ' ' + rest;
      $('#warn-toggle').hidden = !rest;
      $('#warn-toggle').textContent = 'Ver mais';
    }
    const badge = $('#mode-badge');
    badge.textContent = state.selectedString === null ? 'Auto' : 'Manual';
    badge.classList.toggle('manual', state.selectedString !== null);
    $('#btn-auto').classList.toggle('active', state.selectedString === null);
  }

  function renderStrings(activeIdx) {
    const wrap = $('#strings');
    const tg = targets();
    wrap.classList.toggle('many', tg.length > 8);
    if (wrap.childElementCount !== tg.length) {
      wrap.innerHTML = tg.map((_, i) => `<button class="string" data-i="${i}"></button>`).join('');
      wrap.querySelectorAll('.string').forEach((b) => {
        b.addEventListener('click', () => selectString(parseInt(b.dataset.i, 10)));
      });
    }
    wrap.querySelectorAll('.string').forEach((b, i) => {
      const t = tg[i];
      b.innerHTML = `<span>${t.label}<sup>${t.octave}</sup></span><small>${t.freq < 100 ? t.freq.toFixed(1) : Math.round(t.freq)} Hz</small>`;
      b.classList.toggle('active', i === activeIdx);
      b.classList.toggle('tuned', !!state.tunedFlags[i]);
    });
  }

  const ui = {
    needle: $('#needle'), gaugeWrap: $('.gauge-wrap'), note: $('#note-display'), noteName: $('#note-name'),
    noteOct: $('#note-octave'), cents: $('#cents-display'), freq: $('#freq-display'), detected: $('#detected-note'),
  };

  function renderIdle() {
    ui.needle.style.transform = 'rotate(0deg)';
    ui.needle.classList.add('idle'); ui.needle.classList.remove('ok');
    ui.gaugeWrap.classList.remove('in-tune');
    ui.note.className = 'note';
    if (state.selectedString !== null) {
      const t = targets()[state.selectedString];
      ui.noteName.textContent = t.label; ui.noteOct.textContent = t.octave;
      ui.cents.textContent = `Toca a corda ${state.selectedString + 1}`;
    } else {
      ui.noteName.textContent = '–'; ui.noteOct.textContent = '';
      ui.cents.textContent = state.running ? 'Toca uma corda' : 'Afinador parado';
    }
    ui.cents.classList.remove('ok');
    ui.freq.textContent = '— Hz';
    ui.detected.textContent = '';
    renderStrings(state.selectedString);
  }

  function renderReading(r) {
    // r = { freq, cents, stringIdx, target, detectedMidi }
    const tol = state.settings.tolerance;
    const ok = Math.abs(r.cents) <= tol;
    ui.needle.style.transform = `rotate(${centsToAngle(r.cents).toFixed(2)}deg)`;
    ui.needle.classList.remove('idle');
    ui.needle.classList.toggle('ok', ok);
    ui.gaugeWrap.classList.toggle('in-tune', ok);
    ui.note.className = 'note ' + (ok ? 'ok' : r.cents < 0 ? 'flat' : 'sharp');
    ui.noteName.textContent = r.target.label;
    ui.noteOct.textContent = r.target.octave;
    const rounded = Math.round(r.cents);
    ui.cents.textContent = ok ? 'Afinado ✓' : rounded < 0 ? `${Math.abs(rounded)} cents abaixo  ▲ aperta` : `${rounded} cents acima  ▼ alivia`;
    ui.cents.classList.toggle('ok', ok);
    ui.freq.textContent = `${r.freq.toFixed(1)} Hz · alvo ${r.target.freq.toFixed(1)} Hz`;
    if (Math.abs(r.cents) > 50) {
      const nm = midiToName(Math.round(r.detectedMidi), state.settings.notation, state.settings.accidentals);
      ui.detected.textContent = `A ouvir ${nm.name}${nm.octave}`;
    } else ui.detected.textContent = '';
    renderStrings(r.stringIdx);
  }

  /* ---------- Áudio ---------- */
  let audioCtx = null, analyser = null, stream = null, sourceNode = null, demoOsc = null;
  let detector = null, buf = null, byteBuf = null, rafId = 0, lastDetect = 0, silentSink = null, silentFrames = 0;
  const smoother = new MedianSmoother(5);
  let lastGoodAt = 0, lastReading = null, okStreak = 0, dingPlayedFor = -1;
  const demoParam = new URLSearchParams(location.search).get('demo');

  function rmsThreshold() {
    // 0 -> 0.05 (pouco sensível) ... 100 -> ~0.001 (muito sensível)
    return 0.05 * Math.pow(10, -(state.settings.sensitivity / 100) * 1.7);
  }

  function rebuildDetector() {
    if (!audioCtx) return;
    const tg = targets();
    const lo = Math.min(...tg.map((t) => t.freq)) / 1.6;
    const hi = Math.max(...tg.map((t) => t.freq)) * 2.5;
    detector = new PitchDetector(audioCtx.sampleRate, analyser.fftSize, { minFreq: Math.max(20, lo), maxFreq: Math.min(4000, hi) });
    smoother.reset();
  }

  /** Cria o AudioContext (tem de acontecer dentro do toque do utilizador, por causa do iOS). */
  function ensureContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // O iOS marca o contexto como "interrupted"/"suspended" quando o microfone arranca
      // ou quando a app volta do segundo plano; retomamos sempre que isso acontecer.
      audioCtx.addEventListener?.('statechange', () => {
        if (state.running && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
      });
    }
    return audioCtx;
  }

  async function start() {
    const hint = $('#hint');
    hint.classList.remove('error');
    try {
      ensureContext();
      await audioCtx.resume();
      if (demoParam === null) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      }
      // Depois de obter o microfone o iOS pode ter suspendido o contexto: retomar de novo.
      if (audioCtx.state !== 'running') await audioCtx.resume();

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      // O Safari só processa nós que cheguem ao destino: liga o analisador a um ganho mudo.
      silentSink = audioCtx.createGain();
      silentSink.gain.value = 0;
      analyser.connect(silentSink).connect(audioCtx.destination);

      if (demoParam !== null) {
        demoOsc = audioCtx.createOscillator();
        demoOsc.type = 'sawtooth';
        demoOsc.frequency.value = parseFloat(demoParam) || 110;
        const g = audioCtx.createGain(); g.gain.value = 0.2;
        demoOsc.connect(g).connect(analyser);
        demoOsc.start();
        window.__setDemoFreq = (f) => { demoOsc.frequency.value = f; };
        hint.textContent = `Modo demo: sinal sintético de ${demoOsc.frequency.value} Hz.`;
      } else {
        sourceNode = audioCtx.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
        stream.getAudioTracks().forEach((t) => { t.onended = () => { if (state.running) { stop(); hint.textContent = 'O microfone foi desligado pelo sistema. Toca em Iniciar outra vez.'; } }; });
        hint.textContent = 'A ouvir… toca uma corda de cada vez.';
      }
      buf = new Float32Array(analyser.fftSize);
      byteBuf = analyser.getFloatTimeDomainData ? null : new Uint8Array(analyser.fftSize);
      rebuildDetector();
      state.running = true;
      state.tunedFlags = [];
      silentFrames = 0;
      $('#btn-start').textContent = '■ Parar';
      $('#btn-start').classList.add('running');
      requestWakeLock();
      renderIdle();
      loop();
    } catch (err) {
      hint.classList.add('error');
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        hint.textContent = 'Sem acesso ao microfone. Permite-o em Definições → Safari → Microfone, ou no menu "aA" do site.';
      } else if (err && err.name === 'NotFoundError') {
        hint.textContent = 'Não foi encontrado nenhum microfone.';
      } else if (!window.isSecureContext) {
        hint.textContent = 'O microfone só funciona em HTTPS. Abre o site pelo endereço https.';
      } else {
        hint.textContent = 'Erro ao iniciar o áudio: ' + (err && err.message ? err.message : err);
      }
      stop();
    }
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(rafId);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (sourceNode) { try { sourceNode.disconnect(); } catch (e) {} sourceNode = null; }
    if (demoOsc) { try { demoOsc.stop(); demoOsc.disconnect(); } catch (e) {} demoOsc = null; }
    if (silentSink) { try { silentSink.disconnect(); } catch (e) {} silentSink = null; }
    setLevel(0);
    releaseWakeLock();
    $('#btn-start').textContent = '🎤 Iniciar afinador';
    $('#btn-start').classList.remove('running');
    lastReading = null; okStreak = 0;
    renderIdle();
    for (let i = 0; i < history.length; i++) history[i] = null;
    drawHistory();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    if (now - lastDetect < 30) return;
    lastDetect = now;
    if (byteBuf) {
      analyser.getByteTimeDomainData(byteBuf);
      for (let i = 0; i < byteBuf.length; i++) buf[i] = (byteBuf[i] - 128) / 128;
    } else analyser.getFloatTimeDomainData(buf);
    if (tonePlaying) return; // não analisar enquanto toca a nota de referência
    const res = detector.detect(buf);
    setLevel(res.rms);
    // Diagnóstico: se o contexto adormeceu ou o sinal é sempre zero absoluto, avisar
    if (res.rms === 0) {
      silentFrames++;
      if (silentFrames === 60) {
        if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
        $('#hint').textContent = 'Não chega som do microfone. Verifica se outra app o está a usar e se o Safari tem permissão (Definições → Safari → Microfone).';
      }
    } else if (silentFrames) { silentFrames = 0; if (demoParam === null) $('#hint').textContent = 'A ouvir… toca uma corda de cada vez.'; }
    const good = res.freq > 0 && res.rms >= rmsThreshold() && res.probability >= 0.65;
    if (good) {
      const midiFloat = smoother.push(freqToMidiFloat(res.freq, state.settings.a4));
      const tg = targets();
      let idx = state.selectedString;
      if (idx === null) {
        idx = 0;
        for (let i = 1; i < tg.length; i++) if (Math.abs(tg[i].midi - midiFloat) < Math.abs(tg[idx].midi - midiFloat)) idx = i;
      }
      const cents = (midiFloat - tg[idx].midi) * 100;
      lastReading = { freq: res.freq, cents, stringIdx: idx, target: tg[idx], detectedMidi: midiFloat };
      lastGoodAt = now;
      renderReading(lastReading);
      pushHistory(cents);
      if (Math.abs(cents) <= state.settings.tolerance) {
        okStreak++;
        if (okStreak >= 12 && !state.tunedFlags[idx]) {
          state.tunedFlags[idx] = true;
          if (state.settings.ding && dingPlayedFor !== idx) { dingPlayedFor = idx; playDing(); }
          renderStrings(idx);
        }
      } else { okStreak = 0; if (Math.abs(cents) > 15) state.tunedFlags[idx] = false; }
    } else {
      pushHistory(null);
      if (lastReading && now - lastGoodAt > 900) {
        lastReading = null; smoother.reset(); okStreak = 0;
        renderIdle();
      }
    }
    drawHistory();
  }

  /* ---------- Medidor de nível de entrada ---------- */
  const levelBar = $('#level-bar');
  let levelShown = 0;
  function setLevel(rms) {
    // escala logarítmica: -60 dB .. 0 dB
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    levelShown = pct > levelShown ? pct : levelShown * 0.8 + pct * 0.2; // sobe rápido, desce devagar
    levelBar.style.width = levelShown.toFixed(1) + '%';
    const thr = rmsThreshold();
    const thrPct = Math.max(0, Math.min(100, (20 * Math.log10(thr) + 60) / 60 * 100));
    levelBar.parentElement.style.setProperty('--thr', thrPct.toFixed(1) + '%');
    levelBar.classList.toggle('above', rms >= thr);
  }

  /* ---------- Nota de referência ---------- */
  let tonePlaying = false, toneTimer = 0;
  function playTone(freq, duration = 1.6) {
    ensureContext();
    audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.6, t0 + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    master.connect(audioCtx.destination);
    [[1, 1], [2, 0.45], [3, 0.2], [4, 0.08]].forEach(([h, a]) => {
      const o = audioCtx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * h;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(a, t0);
      g.gain.exponentialRampToValueAtTime(a * 0.05, t0 + duration * (1 / h));
      o.connect(g).connect(master);
      o.start(t0); o.stop(t0 + duration + 0.05);
    });
    tonePlaying = true;
    clearTimeout(toneTimer);
    toneTimer = setTimeout(() => { tonePlaying = false; smoother.reset(); }, duration * 1000 + 150);
  }
  function playDing() {
    ensureContext();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.frequency.value = 1320;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.3);
  }

  /* ---------- Wake lock ---------- */
  let wakeLock = null;
  async function requestWakeLock() {
    if (!state.settings.wakeLock || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.running) { requestWakeLock(); audioCtx?.resume(); }
  });

  /* ---------- Selecção de cordas ---------- */
  function selectString(i) {
    state.selectedString = state.selectedString === i ? null : i;
    smoother.reset(); okStreak = 0;
    renderHeader();
    if (lastReading) renderReading({ ...lastReading, stringIdx: state.selectedString ?? lastReading.stringIdx }); else renderIdle();
  }
  $('#btn-auto').addEventListener('click', () => { state.selectedString = null; renderHeader(); renderIdle(); });
  $('#btn-play').addEventListener('click', () => {
    const tg = targets();
    const i = state.selectedString ?? (lastReading ? lastReading.stringIdx : 0);
    playTone(tg[i].freq);
    renderStrings(i);
  });

  /* ---------- Folhas ---------- */
  const backdrop = $('#backdrop');
  function openSheet(id) {
    closeSheets();
    backdrop.hidden = false;
    $(id).hidden = false;
  }
  function closeSheets() {
    document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
    backdrop.hidden = true;
  }
  backdrop.addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));

  function setInstrument(id) {
    state.instrumentId = id;
    const list = getTunings(id, state.custom);
    if (!list.some((t) => t.id === state.tuningId)) state.tuningId = list[0].id;
    afterTuningChange();
  }
  function setTuning(id) { state.tuningId = id; afterTuningChange(); }
  function afterTuningChange() {
    state.selectedString = null; state.tunedFlags = []; dingPlayedFor = -1;
    persist(); renderHeader(); rebuildDetector(); renderIdle();
  }

  function renderInstrumentList() {
    $('#instrument-list').innerHTML = INSTRUMENTS.map((i) => `
      <li><button class="item ${i.id === state.instrumentId ? 'selected' : ''}" data-id="${i.id}">
        <span class="ico">${i.icon}</span><span class="txt"><strong>${i.name}</strong><span>${i.desc} · ${getTunings(i.id, state.custom).length} afinações</span></span>
      </button></li>`).join('');
    $('#instrument-list').querySelectorAll('.item').forEach((b) => b.addEventListener('click', () => { setInstrument(b.dataset.id); closeSheets(); }));
  }
  function renderTuningList() {
    const list = getTunings(state.instrumentId, state.custom);
    const preset = list.filter((t) => !t.custom && !t.song);
    const songs = list.filter((t) => t.song);
    const mine = list.filter((t) => t.custom);
    const item = (t) => `<li><button class="item ${t.id === state.tuningId ? 'selected' : ''}" data-id="${t.id}">
        <span class="txt"><strong>${t.name}</strong><span>${t.desc}</span></span>
        ${t.custom ? `<span class="edit" data-edit="${t.id}" role="button" aria-label="Editar">✎</span>` : ''}
      </button></li>`;
    let html = preset.map(item).join('');
    if (songs.length) html += `<li class="section">Afinações de músicas</li>` + songs.map(item).join('');
    if (mine.length) html += `<li class="section">Personalizadas</li>` + mine.map(item).join('');
    $('#tuning-list').innerHTML = html;
    $('#tuning-list').querySelectorAll('.item').forEach((b) => b.addEventListener('click', (ev) => {
      const edit = ev.target.closest('[data-edit]');
      if (edit) { openCustomEditor(edit.dataset.edit); return; }
      setTuning(b.dataset.id); closeSheets();
    }));
  }
  $('#btn-instrument').addEventListener('click', () => { renderInstrumentList(); openSheet('#sheet-instrument'); });
  $('#btn-tuning').addEventListener('click', () => { renderTuningList(); openSheet('#sheet-tuning'); });
  $('#btn-new-custom').addEventListener('click', () => openCustomEditor(null));

  /* ---------- Editor de afinação personalizada ---------- */
  const editor = { id: null, notes: [] };
  function openCustomEditor(id) {
    const base = currentTuning();
    if (id) {
      const c = state.custom.find((x) => x.id === id);
      editor.id = id; editor.notes = c.notes.slice(); $('#custom-name').value = c.name;
      $('#custom-title').textContent = 'Editar afinação';
      $('#custom-delete').hidden = false;
    } else {
      editor.id = null; editor.notes = base.notes.slice(); $('#custom-name').value = '';
      $('#custom-title').textContent = 'Nova afinação personalizada';
      $('#custom-delete').hidden = true;
    }
    renderEditor();
    openSheet('#sheet-custom');
  }
  function renderEditor() {
    $('#custom-count').textContent = editor.notes.length;
    const names = NOTE_NAMES_SHARP;
    $('#custom-strings').innerHTML = editor.notes.map((n, i) => {
      const midi = noteToMidi(n);
      const idx = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12) - 1;
      const noteOpts = names.map((nm, k) => `<option value="${k}" ${k === idx ? 'selected' : ''}>${midiToName(k, state.settings.notation, state.settings.accidentals).name}</option>`).join('');
      const octOpts = [0, 1, 2, 3, 4, 5, 6, 7].map((o) => `<option value="${o}" ${o === oct ? 'selected' : ''}>Oitava ${o}</option>`).join('');
      return `<div class="custom-row" data-i="${i}">
        <span class="idx">${i + 1}.ª</span>
        <select class="sel-note" aria-label="Nota da corda ${i + 1}">${noteOpts}</select>
        <select class="sel-oct" aria-label="Oitava da corda ${i + 1}">${octOpts}</select>
        <button class="play" aria-label="Ouvir">▶</button>
      </div>`;
    }).join('');
    $('#custom-strings').querySelectorAll('.custom-row').forEach((row) => {
      const i = parseInt(row.dataset.i, 10);
      const update = () => {
        const k = parseInt(row.querySelector('.sel-note').value, 10);
        const o = parseInt(row.querySelector('.sel-oct').value, 10);
        editor.notes[i] = NOTE_NAMES_SHARP[k] + o;
      };
      row.querySelector('.sel-note').addEventListener('change', update);
      row.querySelector('.sel-oct').addEventListener('change', update);
      row.querySelector('.play').addEventListener('click', () => playTone(midiToFreq(noteToMidi(editor.notes[i]), state.settings.a4)));
    });
  }
  $('#custom-minus').addEventListener('click', () => { if (editor.notes.length > 1) { editor.notes.pop(); renderEditor(); } });
  $('#custom-plus').addEventListener('click', () => {
    if (editor.notes.length < 12) {
      const last = noteToMidi(editor.notes[editor.notes.length - 1] || 'E2');
      const next = Math.min(last + 5, 108);
      editor.notes.push(NOTE_NAMES_SHARP[next % 12] + (Math.floor(next / 12) - 1));
      renderEditor();
    }
  });
  $('#custom-save').addEventListener('click', () => {
    const name = $('#custom-name').value.trim() || 'Personalizada ' + (state.custom.length + 1);
    if (editor.id) {
      const c = state.custom.find((x) => x.id === editor.id);
      c.name = name; c.notes = editor.notes.slice();
    } else {
      editor.id = 'custom-' + Date.now().toString(36);
      state.custom.push({ id: editor.id, instrumentId: state.instrumentId, name, notes: editor.notes.slice() });
    }
    saveCustomTunings(state.custom);
    setTuning(editor.id);
    closeSheets();
  });
  $('#custom-delete').addEventListener('click', () => {
    if (!editor.id) return;
    if (!confirm('Apagar esta afinação personalizada?')) return;
    state.custom = state.custom.filter((x) => x.id !== editor.id);
    saveCustomTunings(state.custom);
    if (state.tuningId === editor.id) state.tuningId = getTunings(state.instrumentId, state.custom)[0].id;
    afterTuningChange();
    closeSheets();
  });

  /* ---------- Definições ---------- */
  function renderSettings() {
    const s = state.settings;
    $('#a4-value').textContent = s.a4;
    $('#tr-value').textContent = (s.transpose > 0 ? '+' : '') + s.transpose;
    $('#sensitivity').value = s.sensitivity;
    $('#sens-label').textContent = s.sensitivity < 35 ? '(ambiente ruidoso)' : s.sensitivity > 75 ? '(muito sensível)' : '';
    $('#tolerance').value = s.tolerance; $('#tol-value').textContent = s.tolerance;
    $('#wakelock').checked = s.wakeLock; $('#ding').checked = s.ding;
    [['#seg-notation', s.notation], ['#seg-accidentals', s.accidentals], ['#seg-theme', s.theme]].forEach(([sel, v]) => {
      document.querySelectorAll(sel + ' button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    });
  }
  function settingsChanged() {
    persist(); applyTheme(); drawOkArc(); renderHeader(); rebuildDetector();
    if (lastReading) renderReading(lastReading); else renderIdle();
    renderSettings(); drawHistory();
  }
  const step = (key, delta, min, max) => () => { state.settings[key] = Math.max(min, Math.min(max, state.settings[key] + delta)); settingsChanged(); };
  $('#a4-minus').addEventListener('click', step('a4', -1, 400, 480));
  $('#a4-plus').addEventListener('click', step('a4', 1, 400, 480));
  $('#tr-minus').addEventListener('click', step('transpose', -1, -12, 12));
  $('#tr-plus').addEventListener('click', step('transpose', 1, -12, 12));
  $('#sensitivity').addEventListener('input', (e) => { state.settings.sensitivity = +e.target.value; settingsChanged(); });
  $('#tolerance').addEventListener('input', (e) => { state.settings.tolerance = +e.target.value; settingsChanged(); });
  $('#wakelock').addEventListener('change', (e) => { state.settings.wakeLock = e.target.checked; if (state.running) (e.target.checked ? requestWakeLock() : releaseWakeLock()); persist(); });
  $('#ding').addEventListener('change', (e) => { state.settings.ding = e.target.checked; persist(); });
  [['#seg-notation', 'notation'], ['#seg-accidentals', 'accidentals'], ['#seg-theme', 'theme']].forEach(([sel, key]) => {
    document.querySelectorAll(sel + ' button').forEach((b) => b.addEventListener('click', () => { state.settings[key] = b.dataset.v; settingsChanged(); }));
  });
  $('#btn-settings').addEventListener('click', () => { renderSettings(); openSheet('#sheet-settings'); });
  $('#version').textContent = `Afinador v${VERSION}`;

  $('#warn-toggle').addEventListener('click', () => {
    const open = $('#tuning-warn').classList.toggle('open');
    $('#warn-toggle').textContent = open ? 'Ver menos' : 'Ver mais';
  });

  /* ---------- Iniciar / parar ---------- */
  $('#btn-start').addEventListener('click', () => (state.running ? stop() : start()));

  /* ---------- Service worker ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- Arranque ---------- */
  applyTheme(); buildTicks(); drawOkArc(); renderHeader(); renderIdle(); drawHistory();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#hint').textContent = 'Este navegador não permite acesso ao microfone.';
  }
})();
