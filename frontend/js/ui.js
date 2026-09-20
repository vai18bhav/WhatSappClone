// frontend/js/ui.js
// Shared UI utilities: toasts, theme toggle, audio feedback, shortcuts
'use strict';

const UI = {
  // ─── Toast Notifications ───────────────────────────────────────────────────
  showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `cf-toast ${type}`;
    toast.innerHTML = `
      <span>${escapeHTML(message)}</span>
      <button style="background:none;border:none;color:inherit;cursor:pointer;margin-left:12px;font-size:16px;" aria-label="Close">&times;</button>
    `;

    toast.querySelector('button').onclick = () => toast.remove();
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ─── Audio Chime Synthesizer ────────────────────────────────────────────────
  playSound(type = 'recv') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'recv') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      // Audio playback fails silently if browser policy requires interaction
    }
  },

  // ─── Theme Management ─────────────────────────────────────────────────────
  initTheme() {
    const savedTheme = localStorage.getItem('chatflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('chatflow_theme', next);
    this.updateThemeIcon(next);
    return next;
  },

  updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    const sunPath = 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z';
    const moonPath = 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z';

    btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="${theme === 'dark' ? sunPath : moonPath}"/></svg>`;
  },

  // ─── Avatar Helpers ───────────────────────────────────────────────────────
  renderAvatar(avatarUrl, name, className = '') {
    if (avatarUrl) {
      return `<img src="${avatarUrl}" alt="${escapeHTML(name)}" class="avatar-img ${className}" onerror="this.outerHTML=UI.renderAvatar(null, '${escapeHTML(name)}', '${className}')">`;
    }
    const initial = (name && name.trim().length > 0) ? name.trim()[0].toUpperCase() : '?';
    return `<div class="avatar-placeholder ${className}">${initial}</div>`;
  },

  // ─── Format Time & Headers ────────────────────────────────────────────────
  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  formatDateHeader(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  },

  // ─── Keyboard Shortcuts Setup ──────────────────────────────────────────────
  initShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl + K or '/' to focus global search input
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }

      // Escape key to close open overlays/modals
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.status-modal, .media-preview-modal, .camera-modal, #newChatModal, #newGroupModal');
        modals.forEach((m) => {
          if (m.style.display !== 'none') m.style.display = 'none';
        });
      }
    });
  }
};

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  UI.initShortcuts();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ PWA Service Worker Registered'))
      .catch((err) => console.warn('PWA SW Registration failed:', err));
  }

  const pwaBtn = document.getElementById('pwaInstallBtn');
  if (pwaBtn) {
    pwaBtn.onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          UI.showToast('whatsapp12 App installed successfully!', 'success');
        }
        deferredPrompt = null;
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          alert('To install whatsapp12 on iPhone:\n\n1. Tap the Share button (↑) at bottom\n2. Select "Add to Home Screen"');
        } else {
          alert('To install whatsapp12 on Android:\n\n1. Tap the 3 dots menu (⋮) at top right\n2. Select "Add to Home screen" or "Install app"');
        }
      }
    };
  }
});
