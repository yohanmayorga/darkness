import { getFirebaseStorageClient } from './db.js?v=6.9.1';

export const VOICE_CLOUD_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB capa gratuita Firebase Storage (US-EAST1)

function extFromMime(mimeType = '') {
  const m = String(mimeType).toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

/**
 * Sube una nota de voz directamente a Firebase Storage bajo users/{uid}/journal-audio/
 * Sin persistencia local en caché ni IndexedDB.
 */
export async function uploadVoiceNoteToCloud(note, blob) {
  const fb = await getFirebaseStorageClient();
  if (!fb) return { ok: false, reason: 'storage_not_configured' };

  await fb.auth.authStateReady();
  const user = fb.auth.currentUser;
  if (!user) return { ok: false, reason: 'not_authenticated' };
  if (!blob) return { ok: false, reason: 'missing_blob' };

  const ext = extFromMime(note.mimeType || blob.type);
  const storagePath = note.storagePath || `users/${user.uid}/journal-audio/${note.id}.${ext}`;

  try {
    const ref = fb.storageMod.ref(fb.storage, storagePath);
    await fb.storageMod.uploadBytes(ref, blob, {
      contentType: note.mimeType || blob.type || 'audio/webm',
      customMetadata: {
        noteId: note.id,
        duration: String(note.duration || 0)
      }
    });
    return { ok: true, storagePath };
  } catch (err) {
    console.warn('Error subiendo nota de voz a Firebase Storage:', err?.message || err);
    return { ok: false, reason: err?.code || err?.message || 'upload_error' };
  }
}

/**
 * Obtiene la URL de streaming directa desde Firebase Storage en el momento de escucharlo.
 * Usa getDownloadURL para evitar bloqueos CORS de fetch/getBlob y sin guardar nada en caché local.
 */
export async function getVoiceNoteStreamUrl(note) {
  if (!note?.id) {
    throw new Error('Nota de voz inválida.');
  }
  if (note.uploading) {
    throw new Error('El audio se está subiendo a la nube, espera un momento.');
  }
  if (!note.storagePath) {
    throw new Error('Audio no disponible en la nube.');
  }

  const fb = await getFirebaseStorageClient();
  if (!fb) {
    throw new Error('Configura Firebase Storage para escuchar este audio.');
  }

  await fb.auth.authStateReady();
  if (!fb.auth.currentUser) {
    throw new Error('Inicia sesión en la nube para escuchar este audio.');
  }

  const ref = fb.storageMod.ref(fb.storage, note.storagePath);
  return fb.storageMod.getDownloadURL(ref);
}

/**
 * Elimina el archivo de audio en Firebase Storage
 */
export async function deleteVoiceNoteFiles(note) {
  if (!note?.storagePath) return;
  try {
    const fb = await getFirebaseStorageClient();
    if (!fb) return;
    await fb.auth.authStateReady();
    if (!fb.auth.currentUser) return;
    const ref = fb.storageMod.ref(fb.storage, note.storagePath);
    await fb.storageMod.deleteObject(ref);
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('No se pudo eliminar el audio en Firebase Storage:', err?.message || err);
    }
  }
}

/**
 * Limpia cualquier base de datos IndexedDB heredada de versiones previas (si existiera)
 */
export function purgeLegacyVoiceCache() {
  try {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase('darkness_media_v1');
    }
  } catch { /* noop */ }
}

/**
 * Selecciona el mimeType más compatible para MediaRecorder (iOS/Safari + Android/Chrome + Desktop)
 */
export function pickSupportedAudioMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch { /* ignorar */ }
  }
  return '';
}

export function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes = 0) {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Calcula las estadísticas de memoria usada por notas de voz en el Diario
 */
export function getVoiceStorageStats(entries = []) {
  let totalBytes = 0;
  let totalCount = 0;
  let totalDuration = 0;
  let syncedCount = 0;

  for (const entry of entries) {
    const list = Array.isArray(entry.voiceNotes) ? entry.voiceNotes : [];
    for (const vn of list) {
      totalCount++;
      totalBytes += Number(vn.size) || 0;
      totalDuration += Number(vn.duration) || 0;
      if (vn.synced && vn.storagePath) syncedCount++;
    }
  }

  const percent = Math.min(100, (totalBytes / VOICE_CLOUD_QUOTA_BYTES) * 100);
  return {
    totalBytes,
    totalCount,
    totalDuration,
    syncedCount,
    pendingCount: totalCount - syncedCount,
    quotaBytes: VOICE_CLOUD_QUOTA_BYTES,
    percent
  };
}

/**
 * Inicia una sesión reutilizable de captura de audio con MediaRecorder + espectro en vivo.
 * Devuelve { pause(), resume(), isPaused(), stop(), cancel() }.
 */
export async function startVoiceRecording({ onTick, onLevels, onStateChange, onComplete, onError } = {}) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    onError?.('Tu navegador no soporta grabación de audio');
    return null;
  }

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    onError?.('Permiso de micrófono denegado');
    return null;
  }

  const mimeType = pickSupportedAudioMime();
  let recorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 })
      : new MediaRecorder(stream);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks = [];
  let accumulatedMs = 0;
  let segmentStartMs = Date.now();
  let paused = false;
  let cancelled = false;
  let timerId = null;
  let audioCtx = null;
  let analyser = null;
  let rafId = null;

  const getElapsedMs = () => (paused ? accumulatedMs : accumulatedMs + (Date.now() - segmentStartMs));

  const cleanup = () => {
    clearInterval(timerId);
    timerId = null;
    cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
      analyser = null;
    }
  };

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && typeof onLevels === 'function') {
      audioCtx = new AC();
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const zeroData = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyser) return;
        if (paused) {
          onLevels(zeroData);
        } else {
          analyser.getByteFrequencyData(data);
          onLevels(data);
        }
        rafId = requestAnimationFrame(tick);
      };
      tick();
    }
  } catch { /* fallback sin analyser */ }

  timerId = setInterval(() => {
    if (!paused) {
      onTick?.(getElapsedMs() / 1000);
    }
  }, 250);

  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const duration = Math.max(1, Math.round(getElapsedMs() / 1000));
    const finalMime = recorder?.mimeType || mimeType || 'audio/webm';
    cleanup();
    if (cancelled || !chunks.length) {
      onComplete?.(null);
      return;
    }
    const blob = new Blob(chunks, { type: finalMime });
    onComplete?.({ blob, duration, mimeType: finalMime });
  };

  recorder.start(250);

  return {
    pause: () => {
      if (paused || !recorder || recorder.state !== 'recording') return;
      accumulatedMs += Date.now() - segmentStartMs;
      paused = true;
      try {
        if (typeof recorder.pause === 'function') recorder.pause();
      } catch { /* fallback */ }
      onTick?.(accumulatedMs / 1000);
      onStateChange?.('paused');
    },
    resume: () => {
      if (!paused || !recorder || recorder.state === 'inactive') return;
      paused = false;
      segmentStartMs = Date.now();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      try {
        if (recorder.state === 'paused' && typeof recorder.resume === 'function') recorder.resume();
      } catch { /* fallback */ }
      onTick?.(accumulatedMs / 1000);
      onStateChange?.('recording');
    },
    isPaused: () => paused,
    stop: () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else cleanup();
    },
    cancel: () => {
      cancelled = true;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else {
        cleanup();
        onComplete?.(null);
      }
    }
  };
}
