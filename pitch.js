/* Detector de frequência fundamental (algoritmo YIN com interpolação parabólica).
   Recebe um bloco de amostras (Float32Array) e devolve { freq, probability, rms }.
   freq = -1 quando não há um tom claro. */
'use strict';

class PitchDetector {
  /**
   * @param {number} sampleRate
   * @param {number} bufferSize  tamanho do bloco de análise (potência de 2)
   * @param {object} [opts]
   * @param {number} [opts.threshold=0.15]  limiar YIN (quanto menor, mais exigente)
   * @param {number} [opts.minFreq=25]      frequência mínima detectável (Hz)
   * @param {number} [opts.maxFreq=2000]    frequência máxima detectável (Hz)
   */
  constructor(sampleRate, bufferSize, opts = {}) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.threshold = opts.threshold ?? 0.15;
    this.minFreq = opts.minFreq ?? 25;
    this.maxFreq = opts.maxFreq ?? 2000;
    this.tauMin = Math.max(2, Math.floor(sampleRate / this.maxFreq));
    this.tauMax = Math.min(Math.floor(bufferSize / 2), Math.ceil(sampleRate / this.minFreq));
    this.yin = new Float32Array(this.tauMax + 1);
  }

  static rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  /**
   * @param {Float32Array} buf
   * @returns {{freq:number, probability:number, rms:number}}
   */
  detect(buf) {
    const rms = PitchDetector.rms(buf);
    const n = buf.length;
    const tauMax = Math.min(this.tauMax, Math.floor(n / 2));
    const w = n - tauMax; // janela de integração
    const yin = this.yin;

    // 1) função de diferença
    yin[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < w; j++) {
        const d = buf[j] - buf[j + tau];
        sum += d * d;
      }
      yin[tau] = sum;
    }

    // 2) normalização cumulativa da média
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += yin[tau];
      yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running;
    }

    // 3) limiar absoluto: primeiro mínimo local abaixo do limiar
    let tauEstimate = -1;
    for (let tau = this.tauMin; tau <= tauMax; tau++) {
      if (yin[tau] < this.threshold) {
        while (tau + 1 <= tauMax && yin[tau + 1] < yin[tau]) tau++;
        tauEstimate = tau;
        break;
      }
    }

    // Sem mínimo abaixo do limiar: usa o mínimo global se for razoável (tolerância)
    let probability;
    if (tauEstimate === -1) {
      let best = this.tauMin;
      for (let tau = this.tauMin + 1; tau <= tauMax; tau++) if (yin[tau] < yin[best]) best = tau;
      if (yin[best] > 0.4) return { freq: -1, probability: 0, rms };
      tauEstimate = best;
    }
    probability = 1 - yin[tauEstimate];

    // 4) interpolação parabólica em torno do mínimo
    let betterTau = tauEstimate;
    if (tauEstimate > 1 && tauEstimate < tauMax) {
      const s0 = yin[tauEstimate - 1];
      const s1 = yin[tauEstimate];
      const s2 = yin[tauEstimate + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom;
    }

    const freq = this.sampleRate / betterTau;
    if (freq < this.minFreq || freq > this.maxFreq) return { freq: -1, probability: 0, rms };
    return { freq, probability, rms };
  }
}

/** Mediana das últimas N leituras para estabilizar a agulha. */
class MedianSmoother {
  constructor(size = 5) {
    this.size = size;
    this.values = [];
  }
  reset() { this.values.length = 0; }
  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    const s = this.values.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
}

if (typeof module !== 'undefined') module.exports = { PitchDetector, MedianSmoother };
