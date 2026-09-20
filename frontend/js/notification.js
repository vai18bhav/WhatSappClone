// frontend/js/notification.js
// Browser Notification API and sound alert player
'use strict';

const notificationManager = {
  hasPermission: false,
  audioAlert: null,

  init() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          this.hasPermission = permission === 'granted';
        });
      }
    }

    // Synthesized audio beep via Web Audio API so no external asset required
    this.audioContext = null;
  },

  playBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioContext.currentTime); // D5
      gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio context might be restricted before first click
    }
  },

  notify(title, body, icon = null) {
    this.playBeep();

    if (this.hasPermission && document.hidden) {
      try {
        new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
        });
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  notificationManager.init();
});
