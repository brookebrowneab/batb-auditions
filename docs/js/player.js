/**
 * Audio engine: manages a single shared <audio> element,
 * handles timestamp-bounded playback, backing track toggle,
 * and full-song mode.
 */
import { formatTimestamp } from './data.js';

let audio = null;
let currentClip = null;
let isPlaying = false;
let isFullSongMode = false;
let isBackingTrack = false;
let songDuration = 0;
let onStateChange = null;

// Pending action after the audio source loads
// { type: 'play' | 'seek', seekTo: number }
let pendingAction = null;

/** Initialize the player. Returns the <audio> element. */
export function initPlayer(stateChangeCallback) {
  onStateChange = stateChangeCallback;
  audio = new Audio();
  audio.preload = 'auto';

  audio.addEventListener('loadedmetadata', () => {
    songDuration = audio.duration || 0;
    notifyState();
  });

  audio.addEventListener('canplay', handleCanPlay);
  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('error', handleError);

  return audio;
}

function driveUrl(fileId) {
  if (!fileId) return '';
  // Support raw IDs, full URLs, and relative paths
  if (fileId.startsWith('http') || fileId.startsWith('./') || fileId.startsWith('/')) return fileId;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function activeTrackId() {
  if (!currentClip) return '';
  return isBackingTrack
    ? (currentClip.backingTrackId || currentClip.fullTrackId)
    : currentClip.fullTrackId;
}

/* ── Public API ── */

/** Play a clip. If it's already playing, toggle pause. */
export function playClip(clip) {
  const trackId = isBackingTrack
    ? (clip.backingTrackId || clip.fullTrackId)
    : clip.fullTrackId;

  if (!trackId) return;

  const isSameClip = currentClip?.id === clip.id;
  const url = driveUrl(trackId);
  const isSameSource = audio.src === url;

  // Same clip: toggle play/pause
  if (isSameClip && isSameSource) {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      notifyState();
      return;
    }
    // Resume — if in audition mode and we're past the end, restart from start
    if (!isFullSongMode && audio.currentTime >= currentClip.endTime) {
      audio.currentTime = currentClip.startTime;
    }
    audio.play().catch(playError);
    isPlaying = true;
    notifyState();
    return;
  }

  // Different clip — reset modes
  currentClip = clip;
  isFullSongMode = false;
  isBackingTrack = false;
  songDuration = 0;

  pendingAction = { type: 'play', seekTo: clip.startTime };
  audio.src = driveUrl(clip.fullTrackId);
  audio.load();
  notifyState();
}

export function togglePlayPause() {
  if (!currentClip || !audio.src) return;

  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    // Restart if at end
    if (!isFullSongMode && audio.currentTime >= currentClip.endTime) {
      audio.currentTime = currentClip.startTime;
    }
    audio.play().catch(playError);
    isPlaying = true;
  }
  notifyState();
}

export function setFullSongMode(enabled) {
  isFullSongMode = enabled;
  // If switching back to audition mode and past end, reset
  if (!isFullSongMode && currentClip && audio.currentTime >= currentClip.endTime) {
    audio.currentTime = currentClip.startTime;
  }
  notifyState();
}

export function toggleBackingTrack() {
  if (!currentClip) return;

  const newBacking = !isBackingTrack;
  const trackId = newBacking
    ? (currentClip.backingTrackId || currentClip.fullTrackId)
    : currentClip.fullTrackId;

  if (!trackId) return;

  const savedTime = audio.currentTime;
  const wasPlaying = isPlaying;

  isBackingTrack = newBacking;

  if (wasPlaying) {
    audio.pause();
    isPlaying = false;
  }

  pendingAction = {
    type: wasPlaying ? 'play' : 'seek',
    seekTo: savedTime,
  };

  audio.src = driveUrl(trackId);
  audio.load();
  notifyState();
}

/** Seek to a fraction (0–1) of the visible range. */
export function seek(fraction) {
  if (!currentClip || !audio.src) return;
  const f = Math.max(0, Math.min(1, fraction));

  if (isFullSongMode) {
    audio.currentTime = f * songDuration;
  } else {
    const dur = currentClip.endTime - currentClip.startTime;
    audio.currentTime = currentClip.startTime + f * dur;
  }
  notifyState();
}

/** Seek to an absolute time in seconds (used by admin). */
export function seekTo(seconds) {
  if (!audio.src) return;
  audio.currentTime = Math.max(0, seconds);
  notifyState();
}

export function stopPlayback() {
  if (audio) {
    audio.pause();
    isPlaying = false;
    notifyState();
  }
}

/** Get a snapshot of current player state for UI rendering. */
export function getState() {
  if (!currentClip) {
    return {
      clipId: null, isPlaying: false, isFullSongMode: false,
      isBackingTrack: false, progress: 0, currentTime: 0,
      duration: 0, songDuration: 0,
      currentTimeFormatted: '0:00', durationFormatted: '0:00',
      auditionStartFrac: 0, auditionEndFrac: 1,
      hasBackingTrack: false, audioError: false,
    };
  }

  const clipDur = currentClip.endTime - currentClip.startTime;
  let progress, displayTime, displayDur;

  if (isFullSongMode && songDuration > 0) {
    progress = audio.currentTime / songDuration;
    displayTime = audio.currentTime;
    displayDur = songDuration;
  } else {
    const elapsed = audio.currentTime - currentClip.startTime;
    progress = clipDur > 0 ? elapsed / clipDur : 0;
    displayTime = Math.max(0, elapsed);
    displayDur = clipDur;
  }

  return {
    clipId: currentClip.id,
    isPlaying,
    isFullSongMode,
    isBackingTrack,
    progress: Math.max(0, Math.min(1, progress)),
    currentTime: audio.currentTime,
    duration: displayDur,
    songDuration,
    currentTimeFormatted: formatTimestamp(displayTime),
    durationFormatted: formatTimestamp(displayDur),
    auditionStartFrac: songDuration > 0 ? currentClip.startTime / songDuration : 0,
    auditionEndFrac: songDuration > 0 ? currentClip.endTime / songDuration : 1,
    hasBackingTrack: !!(currentClip.backingTrackId && currentClip.backingTrackId !== currentClip.fullTrackId),
    audioError: false,
  };
}

export function getCurrentClip() {
  return currentClip;
}

/* ── Internal Handlers ── */

function handleCanPlay() {
  if (!pendingAction) return;

  audio.currentTime = pendingAction.seekTo;
  if (pendingAction.type === 'play') {
    audio.play().catch(playError);
    isPlaying = true;
  }
  pendingAction = null;
  notifyState();
}

function handleTimeUpdate() {
  if (!currentClip) return;

  // In audition mode, enforce end boundary
  if (!isFullSongMode && isPlaying && audio.currentTime >= currentClip.endTime) {
    audio.pause();
    audio.currentTime = currentClip.startTime;
    isPlaying = false;
  }
  notifyState();
}

function handleEnded() {
  isPlaying = false;
  notifyState();
}

function handleError() {
  isPlaying = false;
  pendingAction = null;
  notifyState();
}

function playError(err) {
  console.error('Playback failed:', err);
  isPlaying = false;
  notifyState();
}

function notifyState() {
  if (onStateChange) onStateChange(getState());
}
