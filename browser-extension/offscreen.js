// offscreen.js - Audio player for the Shia Azan extension.
//
// Manifest V3 service workers cannot play audio, so the background
// worker creates this hidden offscreen document (reason: AUDIO_PLAYBACK)
// and tells it to stream the adhan MP3 from praytimes.org.
//
// Messages handled:
//   { type: 'PLAY_ADHAN', url, volume }  -> stop any current adhan, play url
//   { type: 'STOP_ADHAN' }               -> stop playback
//   { type: 'GET_ADHAN_STATE' }          -> reply { playing, url }
//
// When playback ends (or fails) we notify the service worker so it can
// close this document again.

let audio = null;
let currentUrl = '';

function notifyEnded(ok) {
  try {
    const p = chrome.runtime.sendMessage({ type: 'ADHAN_ENDED', ok });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // Service worker unreachable; nothing we can do.
  }
}

function stopAudio() {
  if (audio) {
    try { audio.pause(); } catch (e) {}
    try { audio.src = ''; } catch (e) {}
  }
  currentUrl = '';
}

function playAdhan(url, volume) {
  stopAudio();
  currentUrl = url;
  audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.addEventListener('ended', () => notifyEnded(true));
  audio.addEventListener('error', () => notifyEnded(false));
  // play() returns a promise; catch autoplay/network errors so an
  // unhandled rejection doesn't kill the offscreen document.
  audio.play().catch((err) => {
    console.warn('adhan playback failed:', err);
    notifyEnded(false);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'PLAY_ADHAN') {
    playAdhan(msg.url, typeof msg.volume === 'number' ? msg.volume : 1);
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_ADHAN') {
    stopAudio();
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_ADHAN_STATE') {
    sendResponse({ playing: !!(audio && !audio.paused), url: currentUrl });
  }
  // No async response needed for any of these.
});
