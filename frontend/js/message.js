// frontend/js/message.js
// Message bubble rendering, media views, and context actions
'use strict';

const messageRenderer = {
  renderBubble(msg, currentUserId) {
    const isSent = msg.sender_id === currentUserId;
    const rowClass = isSent ? 'sent' : 'received';

    // Quote preview if reply
    let replyHtml = '';
    if (msg.reply_to) {
      replyHtml = `
        <div class="reply-quote-box">
          <div style="font-weight:600; color:var(--secondary);">${escapeHTML(msg.reply_to.sender_name || 'Replied message')}</div>
          <div>${escapeHTML(msg.reply_to.content || `[${msg.reply_to.type}]`)}</div>
        </div>
      `;
    }

    // Media content
    let contentHtml = '';
    if (msg.type === 'text') {
      contentHtml = `<div>${escapeHTML(msg.content)}</div>`;
    } else if (msg.type === 'location') {
      let location = null;
      try { location = JSON.parse(msg.content || '{}'); } catch (error) { location = null; }
      if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
        contentHtml = `
          <a class="location-message" href="${mapUrl}" target="_blank" rel="noopener noreferrer">
            <span class="location-map">📍</span>
            <span><strong>Shared location</strong><small>${location.latitude}, ${location.longitude}</small></span>
          </a>
        `;
      } else {
        contentHtml = '<div>Shared location</div>';
      }
    } else if (msg.type === 'image' && msg.media) {
      contentHtml = `
        <div class="media-img-wrapper" onclick="chatApp.openLightbox('${msg.media.url}', 'image', '${escapeHTML(msg.media.original_name)}')">
          <img src="${msg.media.url}" alt="${escapeHTML(msg.media.original_name)}" loading="lazy">
        </div>
        ${msg.content ? `<div class="media-caption">${escapeHTML(msg.content)}</div>` : ''}
      `;
    } else if (msg.type === 'video' && msg.media) {
      contentHtml = `
        <div class="media-video-wrapper">
          <video controls preload="metadata" src="${msg.media.url}"></video>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px; font-size:12px;">
          <button class="icon-btn" style="font-size:12px; display:inline-flex; align-items:center; gap:4px; padding:2px 6px;" onclick="chatApp.openLightbox('${msg.media.url}', 'video', '${escapeHTML(msg.media.original_name)}')">
            <span>⛶ Fullscreen</span>
          </button>
          <a href="${msg.media.url}" download="${escapeHTML(msg.media.original_name)}" class="icon-btn" title="Download" style="font-size:13px; padding:2px 6px;">⬇️</a>
        </div>
        ${msg.content ? `<div class="media-caption">${escapeHTML(msg.content)}</div>` : ''}
      `;
    } else if (msg.type === 'voice' && msg.media) {
      contentHtml = `
        <div class="voice-msg-player">
          <audio controls src="${msg.media.url}"></audio>
        </div>
      `;
    } else if (msg.type === 'audio' && msg.media) {
      contentHtml = `
        <div class="voice-msg-player">
          <audio controls src="${msg.media.url}"></audio>
        </div>
      `;
    } else if (msg.type === 'document' && msg.media) {
      contentHtml = `
        <div class="media-doc-card">
          <div style="font-size:24px;">📄</div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:500; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">
              ${escapeHTML(msg.media.original_name)}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">${UI.formatTime(msg.created_at)}</div>
          </div>
          <a href="${msg.media.url}" download="${escapeHTML(msg.media.original_name)}" class="icon-btn" title="Download">⬇️</a>
        </div>
        ${msg.content ? `<div style="margin-top:4px;">${escapeHTML(msg.content)}</div>` : ''}
      `;
    }

    // Status ticks for sent messages
    let tickHtml = '';
    if (isSent) {
      const isRead = msg.read_count > 0;
      const tickColor = isRead ? 'var(--secondary)' : 'var(--text-muted)';
      tickHtml = `<span class="tick-icon ${isRead ? 'tick-read' : ''}" title="${isRead ? 'Read' : 'Sent'}">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:${tickColor};display:inline-block;vertical-align:middle;"><path d="M0.41 13.41L6 19L7.41 17.58L1.83 12L0.41 13.41ZM22.58 6.58L11 18.17L6.41 13.58L5 15L11 21L24 8L22.58 6.58ZM18.34 6.58L16.93 5.17L11 11.1L12.41 12.51L18.34 6.58Z"/></svg>
      </span>`;
    }

    return `
      <div class="message-row ${rowClass}" id="msg-${msg.id}" data-id="${msg.id}">
        <div class="message-bubble" oncontextmenu="messageRenderer.openContextMenu(event, '${msg.id}', ${isSent})">
          ${!isSent && msg.sender_name ? `<div class="message-sender-title">${escapeHTML(msg.sender_name)}</div>` : ''}
          ${replyHtml}
          ${contentHtml}
          <div class="message-meta">
            ${msg.is_edited ? '<span style="font-style:italic; margin-right:4px;">(edited)</span>' : ''}
            <span>${UI.formatTime(msg.created_at)}</span>
            ${tickHtml}
          </div>
        </div>
      </div>
    `;
  },

  openContextMenu(e, messageId, isSent) {
    e.preventDefault();
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'activeContextMenu';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;

    menu.innerHTML = `
      <div class="context-menu-item" onclick="chatApp.setReplyMessage('${messageId}')">↩️ Reply</div>
      <div class="context-menu-item" onclick="messageRenderer.copyText('${messageId}')">📋 Copy Text</div>
      <div class="context-menu-item" onclick="messageRenderer.starMessage('${messageId}')">⭐ Star</div>
      <div class="context-menu-item" onclick="messageRenderer.deleteForMe('${messageId}')">🗑️ Delete for Me</div>
      ${isSent ? `<div class="context-menu-item danger" onclick="messageRenderer.deleteForEveryone('${messageId}')">🚫 Delete for Everyone</div>` : ''}
    `;

    document.body.appendChild(menu);

    const closeListener = () => {
      this.closeContextMenu();
      document.removeEventListener('click', closeListener);
    };
    setTimeout(() => document.addEventListener('click', closeListener), 50);
  },

  closeContextMenu() {
    const existing = document.getElementById('activeContextMenu');
    if (existing) existing.remove();
  },

  async copyText(messageId) {
    const bubble = document.querySelector(`#msg-${messageId} .message-bubble`);
    if (bubble) {
      await navigator.clipboard.writeText(bubble.innerText);
      UI.showToast('Copied to clipboard', 'info');
    }
  },

  async starMessage(messageId) {
    try {
      await api.post(`/messages/${messageId}/star`);
      UI.showToast('Message starred', 'success');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async deleteForMe(messageId) {
    try {
      await api.delete(`/messages/${messageId}`, { delete_type: 'for_me' });
      const el = document.getElementById(`msg-${messageId}`);
      if (el) el.remove();
      UI.showToast('Message deleted for you', 'info');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async deleteForEveryone(messageId) {
    try {
      await api.delete(`/messages/${messageId}`, { delete_type: 'for_everyone' });
      const el = document.getElementById(`msg-${messageId}`);
      if (el) el.remove();
      UI.showToast('Message deleted for everyone', 'info');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }
};
