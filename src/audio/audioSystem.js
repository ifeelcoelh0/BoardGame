import { normalizeDiagnosticError, recordDiagnostic } from "../diagnostics/diagnostics.js";
import {
  CHARACTER_VOICE_PLAY_EVENT,
  emoteVoiceEvent,
  pickVoiceVariant,
  voiceSoundKey,
} from "./characterAudio.js";
import { AudioBufferCache } from "./audioBufferCache.js";
import { MusicPlaybackController } from "./musicPlaybackController.js";
import { MUSIC_SCENE } from "./musicCatalog.js";
import { AUDIO_GROUP, audioPolicyForEffect, createAudioTriggerGate, normalizeAudioCue } from "./audioPlaybackPolicy.js";
import {
  AUDIO_SOUND_ALIASES as SND_ALIAS,
  AUDIO_SOUNDS as SND,
  shouldPrimeSoundKey,
} from "./audioManifest.js";

export const AudioSys = (() => {
    let ctx = null, started = false, step = 0, proceduralTimer = null;
    const S = { muted: false, musicVolume: 1, effectsVolume: 1, voicesVolume: 1 };
    const channelGains = new Map();
    const triggerGate = createAudioTriggerGate();
    const activeSampleGroups = new Map();
    let troopSequenceToken = 0;
    const ac = () => {
        if (!ctx) {
            const C = window.AudioContext || window.webkitAudioContext;
            if (!C)
                return null;
            ctx = new C();
        }
        if (ctx && ctx.state === "suspended")
            ctx.resume();
        return ctx;
    };
    const bus = (c) => {
        if (!c.__bus) {
            const b = c.createDynamicsCompressor();
            b.threshold.value = -16;
            b.knee.value = 18;
            b.ratio.value = 5;
            b.attack.value = 4e-3;
            b.release.value = 0.18;
            b.connect(c.destination);
            c.__bus = b;
        }
        return c.__bus;
    };
    const channelBus = (c, channel = "effects") => {
        const key = `${channel}`;
        let gain = channelGains.get(key);
        if (!gain) {
            gain = c.createGain();
            gain.connect(bus(c));
            channelGains.set(key, gain);
        }
        const volume = channel === "voices" ? S.voicesVolume : S.effectsVolume;
        gain.gain.value = S.muted ? 0 : volume;
        return gain;
    };
    const updateChannelVolumes = () => {
        for (const [channel, gain] of channelGains.entries()) {
            const volume = channel === "voices" ? S.voicesVolume : S.effectsVolume;
            gain.gain.value = S.muted ? 0 : volume;
        }
        if (musicPlayback) {
            musicPlayback.setVolume(S.musicVolume);
            musicPlayback.setMuted(S.muted || S.musicVolume <= 0);
        }
    };
    function tone(f, dur, type, vol, delay, slideTo) {
        if (S.muted)
            return;
        const c = ac();
        if (!c)
            return;
        const t0 = c.currentTime + (delay || 0);
        const o = c.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f, t0);
        if (slideTo)
            o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(1e-4, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
        o.connect(g);
        g.connect(channelBus(c, "effects"));
        o.start(t0);
        o.stop(t0 + dur + 0.06);
    }
    function noise(dur, vol, freq, delay) {
        if (S.muted)
            return;
        const c = ac();
        if (!c)
            return;
        const t0 = c.currentTime + (delay || 0);
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
            d[i] = Math.random() * 2 - 1;
        const srcN = c.createBufferSource();
        srcN.buffer = buf;
        const fl = c.createBiquadFilter();
        fl.type = "lowpass";
        fl.frequency.value = freq;
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
        srcN.connect(fl);
        fl.connect(g);
        g.connect(channelBus(c, "effects"));
        srcN.start(t0);
    }
    function swoosh(dur, vol, f0, f1, q, delay) {
        if (S.muted)
            return;
        const c = ac();
        if (!c)
            return;
        const t0 = c.currentTime + (delay || 0);
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
            d[i] = Math.random() * 2 - 1;
        const srcN = c.createBufferSource();
        srcN.buffer = buf;
        const fl = c.createBiquadFilter();
        fl.type = "bandpass";
        fl.Q.value = q || 1.2;
        fl.frequency.setValueAtTime(Math.max(40, f0), t0);
        fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(1e-4, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.25));
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
        srcN.connect(fl);
        fl.connect(g);
        g.connect(channelBus(c, "effects"));
        srcN.start(t0);
    }
    function growl(dur, vol, fStart, fPeak, fEnd, delay) {
        if (S.muted)
            return;
        const c = ac();
        if (!c)
            return;
        const t0 = c.currentTime + (delay || 0);
        const sh = c.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++)
            curve[i] = Math.tanh(3.2 * (i / 128 - 1));
        sh.curve = curve;
        const g = c.createGain();
        g.gain.setValueAtTime(1e-4, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.09);
        g.gain.setValueAtTime(vol, t0 + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
        const trem = c.createGain();
        trem.gain.value = 1;
        const lfo = c.createOscillator();
        lfo.frequency.value = 12 + Math.random() * 5;
        const lfoG = c.createGain();
        lfoG.gain.value = 0.35;
        lfo.connect(lfoG);
        lfoG.connect(trem.gain);
        [0, 7.3].forEach((det) => {
            const o = c.createOscillator();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(Math.max(20, fStart + det), t0);
            o.frequency.exponentialRampToValueAtTime(Math.max(20, fPeak + det), t0 + 0.16);
            o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd + det), t0 + dur);
            o.connect(sh);
            o.start(t0);
            o.stop(t0 + dur + 0.05);
        });
        sh.connect(trem);
        trem.connect(g);
        g.connect(channelBus(c, "effects"));
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
    }
    const bufferCache = new AudioBufferCache();
    async function loadDecodedBuffer(uri, audioContext) {
        return bufferCache.getOrLoad(uri, async () => {
            const response = await fetch(uri);
            if (!response.ok)
                throw new Error(`Falha HTTP ${response.status} ao carregar áudio.`);
            const encoded = await response.arrayBuffer();
            return audioContext.decodeAudioData(encoded);
        });
    }
    let ambientName = null;
    let ambientSource = null;
    let ambientGain = null;
    let ambientToken = 0;
    function stopAmbientSource() {
        ambientToken += 1;
        if (ambientSource) {
            try {
                ambientSource.stop();
            }
            catch {
            }
            ambientSource.disconnect();
            ambientSource = null;
        }
        if (ambientGain) {
            ambientGain.disconnect();
            ambientGain = null;
        }
    }
    function syncAmbient() {
        stopAmbientSource();
        if (!ambientName || S.muted)
            return;
        const list = typeof SND !== "undefined" && SND[ambientName];
        const c = ac();
        if (!c || !list?.length)
            return;
        const name = ambientName;
        const uri = list[0];
        const token = ambientToken;
        const startBuffer = (buf) => {
            if (token !== ambientToken || ambientName !== name || S.muted)
                return;
            const source = c.createBufferSource();
            const gain = c.createGain();
            source.buffer = buf;
            source.loop = true;
            gain.gain.value = name === "lobbyFireplace" ? 0.24 : 0.3;
            source.connect(gain);
            gain.connect(channelBus(c, "effects"));
            source.start();
            ambientSource = source;
            ambientGain = gain;
        };
        const cached = bufferCache.get(uri);
        if (cached) {
            startBuffer(cached);
            return;
        }
        loadDecodedBuffer(uri, c)
            .then(startBuffer)
            .catch((error) => reportDecodeFailure(uri, error));
    }
    function stopSampleGroup(group) {
        const active = activeSampleGroups.get(group);
        if (!active) return;
        for (const source of [...active]) {
            try { source.stop(); } catch {}
            try { source.disconnect(); } catch {}
        }
        active.clear();
        activeSampleGroups.delete(group);
    }
    function playSample(name, vol, delay, onDur, options = {}) {
        if (S.muted) {
            options.onStart?.();
            return true;
        }
        const list = typeof SND !== "undefined" && (SND[name] || SND[SND_ALIAS[name]]);
        if (!list || !list.length)
            return false;
        const c = ac();
        if (!c)
            return false;
        const requestedIndex = Number.isInteger(options.sampleIndex) ? options.sampleIndex : null;
        const idx = requestedIndex == null
            ? Math.floor(Math.random() * list.length)
            : Math.max(0, Math.min(list.length - 1, requestedIndex));
        const uri = list[idx];
        const requestedAt = performance.now();
        const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 1400;
        const group = options.group || null;
        const replace = options.replace === true;
        const maxVoices = Number.isFinite(options.maxVoices) ? Math.max(1, options.maxVoices) : Infinity;
        const go = (buf) => {
            if (performance.now() - requestedAt > ttlMs) return;
            if (group && replace) stopSampleGroup(group);
            const active = group ? (activeSampleGroups.get(group) || new Set()) : null;
            if (active && active.size >= maxVoices) return;
            const srcS = c.createBufferSource();
            srcS.buffer = buf;
            const g = c.createGain();
            g.gain.value = vol || 1;
            srcS.connect(g);
            g.connect(channelBus(c, group === AUDIO_GROUP.VOICE ? "voices" : "effects"));
            if (active) {
                active.add(srcS);
                activeSampleGroups.set(group, active);
                srcS.onended = () => {
                    active.delete(srcS);
                    if (!active.size) activeSampleGroups.delete(group);
                    try { srcS.disconnect(); } catch {}
                    try { g.disconnect(); } catch {}
                };
            }
            options.onStart?.({ index: idx, uri });
            srcS.start(c.currentTime + (delay || 0));
            if (onDur)
                onDur(buf.duration);
        };
        const cached = bufferCache.get(uri);
        if (cached) {
            go(cached);
            return true;
        }
        loadDecodedBuffer(uri, c)
            .then(go)
            .catch((error) => reportDecodeFailure(uri, error));
        return true;
    }
    function emitCharacterVoice(character, event, variant) {
        if (typeof window === "undefined" || typeof window.dispatchEvent !== "function")
            return;
        const EventCtor = window.CustomEvent;
        if (typeof EventCtor !== "function")
            return;
        window.dispatchEvent(new EventCtor(CHARACTER_VOICE_PLAY_EVENT, {
            detail: { character, event, variant },
        }));
    }
    function playCharacterVoice(character, event) {
        if (!triggerGate.allow("voice"))
            return false;
        const key = voiceSoundKey(character, event);
        const variant = pickVoiceVariant(event);
        if (!key || !variant)
            return false;
        return playSample(key, 0.95, 0, null, {
            group: AUDIO_GROUP.VOICE,
            replace: true,
            ttlMs: 2200,
            sampleIndex: variant - 1,
            onStart: () => emitCharacterVoice(character, event, variant),
        });
    }
    function playSampleSeries(names, vol = 1, token = troopSequenceToken) {
        const queue = [...names];
        const next = () => {
            if (token !== troopSequenceToken) return;
            const name = queue.shift();
            if (!name) return;
            if (!playSample(name, vol, 0, (duration) => {
                const delayMs = Math.max(0, duration * 1000 - 35);
                window.setTimeout(next, delayMs);
            }, { ttlMs: 1800 })) next();
        };
        next();
    }
    function playTroopCard(subtype) {
        if (!triggerGate.allow("card")) return false;
        troopSequenceToken += 1;
        const token = troopSequenceToken;
        if (subtype === "cavaleiro") {
            playSample("troopCardKnightHorse", 0.9, 0, null, { ttlMs: 1600 });
            playSampleSeries(["troopCardKnightSword1", "troopCardKnightSword2", "troopCardKnightSword3"], 1, token);
            return true;
        }
        if (subtype === "arqueiro") {
            return playSample("troopCardArcher", 1, 0, null, { ttlMs: 1800 });
        }
        if (subtype === "catapulta") return playSample("troopCardCatapult", 1, 0, null, { ttlMs: 1800 });
        return false;
    }
    let musicPlayback = null;
    let desiredMusicScene = MUSIC_SCENE.LOBBY;
    function ensureMusicPlayback(c) {
        if (musicPlayback) return musicPlayback;
        try {
            musicPlayback = new MusicPlaybackController({ audioContext: c, destination: bus(c) });
            musicPlayback.setVolume(S.musicVolume);
            musicPlayback.setMuted(S.muted || S.musicVolume <= 0);
            musicPlayback.setScene(desiredMusicScene, { immediate: true });
            return musicPlayback;
        } catch (error) {
            recordDiagnostic("music-start-failed", normalizeDiagnosticError(error));
            return null;
        }
    }
    function startMusic() {
        const c = ac();
        const player = c ? ensureMusicPlayback(c) : null;
        if (!player) return;
        player.setScene(desiredMusicScene, { immediate: true });
        player.start();
    }
    /* Loops de ambiente são longos e só um está ativo de cada vez. O
       syncAmbient carrega-os quando são precisos, portanto não vale a pena
       aquecê-los no arranque. */
    let decodeFailureReported = false;
    function reportDecodeFailure(uri, error) {
        /* O `.catch(() => {})` que aqui estava é a razão pela qual ninguém
           reparou que os 67 ficheiros Ogg Vorbis eram silenciosos em Safari.
           Uma falha de descodificação é um problema de formato, não de rede, e
           tem de ser visível. Reporta-se uma vez por sessão para não encher o
           localStorage quando falham dezenas de ficheiros pela mesma razão. */
        if (decodeFailureReported)
            return;
        decodeFailureReported = true;
        recordDiagnostic("audio-decode-failed", { uri, ...normalizeDiagnosticError(error) });
    }
    function primeSamples() {
        if (typeof SND === "undefined")
            return;
        const c = ac();
        if (!c)
            return;
        const queue = [];
        const queued = new Set();
        for (const name of Object.keys(SND)) {
            if (name.startsWith("voice_event_") || !shouldPrimeSoundKey(name))
                continue;
            for (const uri of SND[name]) {
                if (!queued.has(uri) && !bufferCache.has(uri) && !bufferCache.isLoading(uri)) {
                    queued.add(uri);
                    queue.push(uri);
                }
            }
        }
        /* Antes eram cerca de 90 fetch simultâneos no arranque, o que satura a
           fila de pedidos do browser e compete com o carregamento do lobby 3D.
           Quatro em paralelo enche a cache sem bloquear o resto. */
        let active = 0;
        const pump = () => {
            while (active < 4 && queue.length) {
                const uri = queue.shift();
                active += 1;
                loadDecodedBuffer(uri, c)
                    .catch((error) => reportDecodeFailure(uri, error))
                    .finally(() => {
                        active -= 1;
                        pump();
                    });
            }
        };
        pump();
    }
    function metal(fs, dur, vol, delay) {
        fs.forEach((f, i) => tone(f, dur * (1 - i * 0.12), "triangle", vol * Math.pow(0.72, i), delay || 0));
    }
    const FX = {
        tap: () => tone(700, 0.05, "square", 0.06),
        dice: () => {
            playSample("diceShake", 0.95, 0, (d) => playSample("diceThrow", 1, Math.max(0.1, d - 0.22)));
        },
        coin: () => {
            playSample("coinDrop", 0.85);
        },
        build: () => {
            playSample("buildHit", 0.85);
        },
        card: () => {
            playSample("cardSlide", 0.8);
        },
        bad: () => {
            tone(311, 0.22, "sawtooth", 0.13, 0, 196);
            tone(155, 0.3, "sawtooth", 0.11, 0.05);
        },
        dragon: () => {
            playSample("dragonRoar", 0.72);
        },
        disaster: () => {
            growl(1.5, 0.26, 70, 90, 30, 0);
            swoosh(1.4, 0.2, 500, 60, 0.6, 0.05);
            tone(49, 1.3, "sine", 0.22, 0.1, 30);
        },
        tsunami: () => { playSample("tsunami", 0.92); },
        lobbyStart: () => { playSample("lobbyStart", 0.9); },
        lobbySignature: () => { playSample("lobbySignature", 0.82, 0, null, { group: AUDIO_GROUP.UI, replace: true, ttlMs: 1400 }); },
        uiClick: () => { playSample("uiClick", 0.5, 0, null, { group: AUDIO_GROUP.UI, replace: true, ttlMs: 550 }); },
        yourTurn: () => { playSample("yourTurn", 1, 0, null, { group: AUDIO_GROUP.CEREMONIAL, replace: true, ttlMs: 1700 }); },
        tradeOffer: () => { playSample("tradeOffer", 1, 0, null, { group: AUDIO_GROUP.GAME, maxVoices: 1, ttlMs: 1300 }); },
        disasterGreed: () => { playSample("disasterGreed", 0.72, 0, null, { group: AUDIO_GROUP.CEREMONIAL, replace: true, ttlMs: 3400 }); },
        disasterPlague: () => { playSample("disasterPlague", 0.76, 0, null, { group: AUDIO_GROUP.CEREMONIAL, replace: true, ttlMs: 2400 }); },
        disasterTribute: () => { playSample("disasterTribute", 0.74, 0, null, { group: AUDIO_GROUP.CEREMONIAL, replace: true, ttlMs: 2600 }); },
        lobbyBook: () => { playSample("lobbyBook", 0.72, 0, null, { group: AUDIO_GROUP.UI, replace: true, ttlMs: 900 }); },
        swordP: () => {
            playSample("swordHit", 1.25);
        },
        bowP: () => {
            playSample("arrowHit", 1.25);
        },
        catP: () => {
            playSample("catCreak", 1.1);
        },
        award: () => {
            playSample("harp", 0.95);
        },
        flap: () => {
            playSample("dragonFlap", 0.85);
        },
        swoop: () => {
            playSample("swoop", 0.95);
        },
        chatpop: () => {
            tone(880, 0.06, "sine", 0.1);
            tone(1174, 0.09, "sine", 0.09, 0.06);
        },
        deal: () => {
            tone(659, 0.09, "sine", 0.13);
            tone(987, 0.16, "sine", 0.11, 0.09);
            playSample("coinDrop", 0.45, 0.16);
        },
        clash: () => {
            metal([2489, 3729, 5274, 6270], 0.34, 0.16);
            swoosh(0.07, 0.3, 5e3, 2e3, 1, 0);
            noise(0.12, 0.22, 200, 0.02);
            metal([1975, 2960], 0.22, 0.08, 0.1);
        },
        arrow: () => {
            swoosh(0.22, 0.26, 3400, 700, 2.2, 0);
            tone(210, 0.05, "square", 0.14, 0.2);
            noise(0.06, 0.18, 400, 0.2);
        },
        catapult: () => {
            growl(0.28, 0.16, 120, 80, 55, 0);
            swoosh(0.4, 0.24, 500, 2200, 1, 0.22);
            noise(0.18, 0.34, 130, 0.62);
            tone(55, 0.3, "sine", 0.24, 0.62, 34);
        },
        horn: () => {
            [130.8, 155.6].forEach((f, i) => {
                tone(f, 1.1, "sawtooth", 0.12, i * 0.05);
                tone(f * 2, 1, "sawtooth", 0.06, i * 0.05);
            });
            swoosh(0.9, 0.06, 700, 300, 0.8, 0.1);
        },
        bell: () => {
            metal([659, 1318, 1975, 2637], 0.9, 0.14);
            metal([880, 1760], 0.7, 0.08, 0.28);
        },
        march: () => {
            noise(0.05, 0.2, 900, 0);
            noise(0.05, 0.16, 900, 0.14);
            tone(98, 0.12, "triangle", 0.16, 0.14);
            noise(0.07, 0.22, 700, 0.3);
        },
        fanfare: () => {
            playSample("fanfareWin", 0.9);
        }
    };
    const ROOTS = [110, 98, 87.31, 82.41];
    const MODE = [0, 2, 3, 5, 7, 8, 10, 12];
    const PAT = [0, 4, 2, 5, 4, 7, 5, 2, 0, 4, 2, 6, 7, 5, 4, 2];
    function tick() {
        if (S.muted || document.hidden || typeof SND !== "undefined" && SND.music) {
            step++;
            return;
        }
        const bar = Math.floor(step / 16) % 4;
        if (step % 16 === 0) {
            tone(ROOTS[bar], 4.4, "sine", 0.038);
            tone(ROOTS[bar] * 1.5, 4.4, "sine", 0.024);
            noise(0.09, 0.09, 140);
        }
        if (step % 16 === 8)
            noise(0.06, 0.055, 200);
        const deg = PAT[step % 16];
        if (step % 2 === 0 || Math.random() < 0.35) {
            const f = 220 * Math.pow(2, MODE[deg % 8] / 12) * (deg >= 8 ? 2 : 1);
            tone(f, 0.36, "triangle", 0.048);
            if (Math.random() < 0.15)
                tone(f * 2, 0.3, "sine", 0.018, 0.03);
        }
        step++;
    }
    return {
        get muted() {
            return S.muted;
        },
        get volumes() {
            return { music: S.musicVolume, effects: S.effectsVolume, voices: S.voicesVolume };
        },
        configure(values = {}) {
            const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
            S.musicVolume = clamp(values.musicVolume, S.musicVolume);
            S.effectsVolume = clamp(values.effectsVolume, S.effectsVolume);
            S.voicesVolume = clamp(values.voicesVolume, S.voicesVolume);
            updateChannelVolumes();
            return this.volumes;
        },
        setMuted(value) {
            const next = value === true;
            if (S.muted === next) return S.muted;
            S.muted = next;
            if (!S.muted) ac();
            updateChannelVolumes();
            musicPlayback?.setMuted(S.muted || S.musicVolume <= 0);
            syncAmbient();
            return S.muted;
        },
        toggle() {
            S.muted = !S.muted;
            if (!S.muted)
                ac();
            updateChannelVolumes();
            /* Silenciar tem de parar o elemento, não só baixar o ganho: em
               streaming, ganho 0 continua a descarregar o ficheiro inteiro e a
               descodificar em contínuo. */
            musicPlayback?.setMuted(S.muted || S.musicVolume <= 0);
            syncAmbient();
            return S.muted;
        },
        play(n) {
            if (n && n.indexOf("emv:") === 0) {
                const pp = n.split(":");
                const event = emoteVoiceEvent(pp[2]);
                if (event)
                    return playCharacterVoice(pp[1], event);
                if (!triggerGate.allow("voice")) return false;
                const voiceOptions = { group: AUDIO_GROUP.VOICE, replace: true, ttlMs: 2200 };
                if (playSample("em_" + pp[1] + "_" + pp[2], 0.9, 0, null, voiceOptions)) return true;
                if (playSample("voice_" + pp[1], 0.9, 0, null, voiceOptions)) return true;
                FX.card();
                return true;
            }
            if (n && n.indexOf("voice_") === 0) {
                if (!triggerGate.allow("voice")) return false;
                if (!playSample(n, 0.9, 0, null, { group: AUDIO_GROUP.VOICE, replace: true, ttlMs: 2200 }))
                    FX.card();
                return true;
            }
            if (!FX[n] || !triggerGate.allow(n)) return false;
            FX[n]();
            return true;
        },
        playCue(value) {
            const cue = normalizeAudioCue(value);
            if (!cue) return false;
            let played = false;
            if (cue.sfx) played = this.play(cue.sfx) || played;
            if (cue.troop) played = playTroopCard(cue.troop) || played;
            if (cue.voice) played = this.playVoice(cue.voice.character, cue.voice.event) || played;
            return played;
        },
        playVoice(character, event) {
            return playCharacterVoice(character, event);
        },
        playTroopCard,
        setMusicScene(scene) {
            if (!Object.values(MUSIC_SCENE).includes(scene)) return false;
            desiredMusicScene = scene;
            return musicPlayback ? musicPlayback.setScene(scene) : true;
        },
        beginGameEntryMusic() { musicPlayback?.beginGameEntry(); },
        cancelGameEntryMusic() { musicPlayback?.cancelGameEntry(); },
        getMusicSnapshot() { return musicPlayback?.snapshot?.() || { scene: desiredMusicScene, started: false }; },
        setAmbient(name) { ambientName = name || null; syncAmbient(); },
        clearAmbient(name) { if (name && ambientName !== name) return; ambientName = null; stopAmbientSource(); },
        start() {
            const c = ac();
            if (!c || started)
                return;
            started = true;
            primeSamples();
            startMusic();
            syncAmbient();
            /* O `tick` é a música procedural de fallback e a primeira coisa que
               faz é desistir se `SND.music` existir. Como existe sempre, este
               intervalo acordava a cada 265 ms para incrementar um contador e
               nunca era limpo. Agora só arranca se não houver música gravada. */
            if (typeof SND === "undefined" || !SND.music)
                proceduralTimer = setInterval(tick, 265);
        },
        stop() {
            if (proceduralTimer != null) {
                clearInterval(proceduralTimer);
                proceduralTimer = null;
            }
            musicPlayback?.stop();
            musicPlayback = null;
            desiredMusicScene = MUSIC_SCENE.LOBBY;
            stopAmbientSource();
            for (const gain of channelGains.values()) { try { gain.disconnect(); } catch {} }
            channelGains.clear();
            troopSequenceToken += 1;
            for (const group of [...activeSampleGroups.keys()]) stopSampleGroup(group);
            triggerGate.reset();
            bufferCache.clear();
            started = false;
        }
    };
})();
