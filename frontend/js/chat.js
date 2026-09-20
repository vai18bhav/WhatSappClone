// frontend/js/chat.js
// Main application controller for ChatFlow
'use strict';

const chatApp = {
  currentChatId: null,
  currentChat: null,
  currentUser: null,
  chats: [],
  activeTab: 'chats',
  replyingToMessage: null,
  typingTimeout: null,

  async init() {
    auth.requireAuth();
    this.currentUser = auth.getUser();

    // Render my avatar in top left
    this.renderHeaderAvatar();

    // Initialize Socket.IO connection
    const socket = socketClient.connect();
    if (socket) {
      this.initSocketEvents(socket);
      webrtcCall.init(socket);
    }

    // Attach UI event listeners
    this.bindEvents();

    // Load conversation list
    await this.loadChats();
    this.initStatuses();
  },

  renderHeaderAvatar() {
    const miniEl = document.getElementById('myAvatarMini');
    if (miniEl && this.currentUser) {
      miniEl.innerHTML = UI.renderAvatar(
        this.currentUser.avatar ? `/uploads/${this.currentUser.avatar}` : null,
        this.currentUser.display_name
      );
    }
  },

  bindEvents() {
    const myStatusBtn = document.getElementById('myStatusBtn');
    const closeStatusComposerBtn = document.getElementById('closeStatusComposerBtn');
    const postStatusBtn = document.getElementById('postStatusBtn');
    if (myStatusBtn) {
      myStatusBtn.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-add')) {
          e.stopPropagation();
          this.openStatusComposer();
          return;
        }
        if (this.myStatuses && this.myStatuses.length > 0) {
          this.openStatusViewer(this.myStatuses);
        } else {
          this.openStatusComposer();
        }
      });
    }
    if (closeStatusComposerBtn) closeStatusComposerBtn.addEventListener('click', () => this.closeStatusComposer());
    if (postStatusBtn) postStatusBtn.addEventListener('click', () => this.postStatus());

    // Message input typing detection
    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        } else {
          this.handleTypingEmit();
        }
      });
    }

    // Send button click
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Attachment file input
    const fileInput = document.getElementById('fileInput');
    const attachBtn = document.getElementById('attachBtn');
    const attachMenu = document.getElementById('attachMenu');
    const mediaFileInput = document.getElementById('mediaFileInput');
    const docFileInput = document.getElementById('docFileInput');
    const attachPhotoVideoBtn = document.getElementById('attachPhotoVideoBtn');
    const attachCameraBtn = document.getElementById('attachCameraBtn');
    const attachDocBtn = document.getElementById('attachDocBtn');
    const shareLocationBtn = document.getElementById('shareLocationBtn');

    if (attachBtn) {
      attachBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (attachMenu) {
          attachMenu.style.display = attachMenu.style.display === 'flex' ? 'none' : 'flex';
        }
      });
    }
    if (attachPhotoVideoBtn && mediaFileInput) {
      attachPhotoVideoBtn.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        mediaFileInput.click();
      });
      mediaFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }
    if (attachDocBtn && docFileInput) {
      attachDocBtn.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        docFileInput.click();
      });
      docFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }
    if (attachCameraBtn) {
      attachCameraBtn.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        this.openCamera();
      });
    }
    if (shareLocationBtn) {
      shareLocationBtn.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        this.shareLocation();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    document.addEventListener('click', (event) => {
      if (attachMenu && !attachMenu.contains(event.target) && event.target !== attachBtn) {
        attachMenu.style.display = 'none';
      }
    });

    // Voice recording buttons
    const voiceBtn = document.getElementById('voiceBtn');
    const stopVoiceBtn = document.getElementById('stopVoiceBtn');
    const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => this.startRecording());
    }
    if (stopVoiceBtn) {
      stopVoiceBtn.addEventListener('click', () => this.stopAndSendRecording());
    }
    if (cancelVoiceBtn) {
      cancelVoiceBtn.addEventListener('click', () => this.cancelRecording());
    }

    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    if (closeCameraBtn) {
      closeCameraBtn.addEventListener('click', () => this.closeCamera());
    }
    if (capturePhotoBtn) {
      capturePhotoBtn.addEventListener('click', () => this.captureCameraPhoto());
    }

    // Emoji Picker toggle
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
    }

    // Search bar filter
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
    }

    // Call buttons
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    if (voiceCallBtn) {
      voiceCallBtn.addEventListener('click', () => this.initiateCall('voice'));
    }
    if (videoCallBtn) {
      videoCallBtn.addEventListener('click', () => this.initiateCall('video'));
    }

    // Close reply bar
    const closeReplyBtn = document.getElementById('closeReplyBtn');
    if (closeReplyBtn) {
      closeReplyBtn.addEventListener('click', () => this.clearReply());
    }

    const mobileBackBtn = document.getElementById('mobileBackBtn');
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', () => {
        document.getElementById('chatAppRoot')?.classList.remove('chat-open');
      });
    }
  },

  initSocketEvents(socket) {
    socket.on('receive_message', (msg) => {
      if (msg.sender_id !== this.currentUser?.id) {
        UI.playSound('recv');
      }
      if (msg.chat_id === this.currentChatId) {
        this.appendMessage(msg);
        this.scrollToBottom();
        // Send read receipt if we're not the sender
        if (msg.sender_id !== this.currentUser.id) {
          socketClient.sendReadReceipt(this.currentChatId, [msg.id]);
        }
      } else {
        // Notification for message in another chat
        notificationManager.notify(msg.sender_name || 'New Message', msg.content || `Sent a ${msg.type}`);
      }

      this.updateChatInList(msg.chat_id, msg);
    });

    socket.on('typing', (data) => {
      if (data.chatId === this.currentChatId) {
        this.showTypingIndicator(true);
      }
    });

    socket.on('stop_typing', (data) => {
      if (data.chatId === this.currentChatId) {
        this.showTypingIndicator(false);
      }
    });

    socket.on('user_status_change', (data) => {
      this.updateUserPresenceUI(data);
    });

    socket.on('messages_read_receipt', (data) => {
      if (data.chatId === this.currentChatId) {
        this.markMessagesAsReadInDOM(data.messageIds);
      }
    });

    socket.on('status_updated', () => {
      this.loadStatuses();
    });
  },

  async loadChats() {
    try {
      const res = await api.get('/chats');
      if (res.success && res.data) {
        this.chats = res.data;
        this.renderChatList(this.chats);
      }
    } catch (err) {
      UI.showToast('Failed to load conversations', 'error');
    }
  },

  async initStatuses() {
    const avatar = document.getElementById('myStatusAvatar');
    if (avatar && this.currentUser) {
      avatar.innerHTML = UI.renderAvatar(
        this.currentUser.avatar ? `/uploads/${this.currentUser.avatar}` : null,
        this.currentUser.display_name,
      );
    }

    const colors = ['#075E54', '#128C7E', '#7B2CBF', '#D97706', '#BE123C', '#1D4ED8'];
    const colorsEl = document.getElementById('statusColors');
    if (colorsEl) {
      colorsEl.innerHTML = colors.map((color, index) => `
        <button class="status-color ${index === 0 ? 'selected' : ''}" type="button" data-color="${color}" style="background:${color}" title="Choose background"></button>
      `).join('');
      colorsEl.addEventListener('click', (event) => {
        const button = event.target.closest('.status-color');
        if (!button) return;
        colorsEl.querySelectorAll('.status-color').forEach((item) => item.classList.remove('selected'));
        button.classList.add('selected');
        const input = document.getElementById('statusTextInput');
        if (input) input.style.background = button.dataset.color;
      });
    }

    // Media attachment listener for Status
    const statusMediaBtn = document.getElementById('statusMediaBtn');
    const statusFileInput = document.getElementById('statusFileInput');
    const removeMediaBtn = document.getElementById('removeStatusMediaBtn');

    if (statusMediaBtn && statusFileInput) {
      statusMediaBtn.addEventListener('click', () => statusFileInput.click());
      statusFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.selectedStatusFile = file;
          this.previewStatusMedia(file);
        }
      });
    }

    if (removeMediaBtn) {
      removeMediaBtn.addEventListener('click', () => this.clearStatusMediaPreview());
    }

    await this.loadStatuses();
  },

  previewStatusMedia(file) {
    const previewBox = document.getElementById('statusMediaPreviewBox');
    const imgPreview = document.getElementById('statusImagePreview');
    const videoPreview = document.getElementById('statusVideoPreview');
    const audioPreview = document.getElementById('statusAudioPreview');

    if (!previewBox) return;
    previewBox.style.display = 'flex';
    imgPreview.style.display = 'none';
    videoPreview.style.display = 'none';
    audioPreview.style.display = 'none';

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      imgPreview.src = url;
      imgPreview.style.display = 'block';
    } else if (file.type.startsWith('video/')) {
      videoPreview.src = url;
      videoPreview.style.display = 'block';
    } else if (file.type.startsWith('audio/')) {
      audioPreview.src = url;
      audioPreview.style.display = 'block';
    }
  },

  clearStatusMediaPreview() {
    this.selectedStatusFile = null;
    const previewBox = document.getElementById('statusMediaPreviewBox');
    const fileInput = document.getElementById('statusFileInput');
    if (previewBox) previewBox.style.display = 'none';
    if (fileInput) fileInput.value = '';
  },

  async loadStatuses() {
    try {
      const res = await api.get('/statuses');
      const allStatuses = res.data || [];
      const myId = this.currentUser?.id;

      this.myStatuses = allStatuses.filter((s) => s.user_id === myId);
      const otherStatuses = allStatuses.filter((s) => s.user_id !== myId);

      const myStatusBtn = document.getElementById('myStatusBtn');
      if (myStatusBtn) {
        const smallText = myStatusBtn.querySelector('small');
        if (smallText) {
          if (this.myStatuses.length > 0) {
            smallText.innerText = `${this.myStatuses.length} active update${this.myStatuses.length > 1 ? 's' : ''}`;
          } else {
            smallText.innerText = 'Tap to add status';
          }
        }
      }

      this.renderStatuses(otherStatuses);
    } catch (err) {
      UI.showToast('Failed to load statuses', 'error');
    }
  },

  renderStatuses(statuses) {
    const list = document.getElementById('statusList');
    if (!list) return;

    if (!statuses || statuses.length === 0) {
      list.innerHTML = '';
      return;
    }

    const grouped = statuses.reduce((result, status) => {
      if (!result[status.user_id]) result[status.user_id] = [];
      result[status.user_id].push(status);
      return result;
    }, {});

    list.innerHTML = Object.values(grouped).map((userStatuses) => {
      const status = userStatuses[0];
      const avatar = UI.renderAvatar(status.avatar ? `/uploads/${status.avatar}` : null, status.display_name);
      return `<button class="status-contact" type="button" data-user-id="${status.user_id}">
        <span class="status-ring">${avatar}</span><span>${escapeHTML(status.display_name)}</span>
      </button>`;
    }).join('');

    list.querySelectorAll('.status-contact').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.dataset.userId;
        const userStatuses = grouped[userId];
        if (userStatuses) {
          this.openStatusViewer(userStatuses);
        }
      });
    });
  },

  openStatusComposer() {
    const modal = document.getElementById('statusComposerModal');
    if (modal) {
      modal.style.display = 'flex';
      this.clearStatusMediaPreview();
      const input = document.getElementById('statusTextInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  },

  closeStatusComposer() {
    const modal = document.getElementById('statusComposerModal');
    if (modal) modal.style.display = 'none';
    this.clearStatusMediaPreview();
  },

  async postStatus() {
    const input = document.getElementById('statusTextInput');
    const color = document.querySelector('.status-color.selected')?.dataset.color || '#075E54';
    const content = input?.value.trim();

    if (!content && !this.selectedStatusFile) {
      return UI.showToast('Write a text update or select a media file', 'error');
    }

    try {
      if (this.selectedStatusFile) {
        const formData = new FormData();
        formData.append('file', this.selectedStatusFile);
        if (content) formData.append('content', content);
        formData.append('background', color);
        await api.post('/statuses', formData);
      } else {
        await api.post('/statuses', { content, background: color });
      }

      input.value = '';
      this.closeStatusComposer();
      await this.loadStatuses();
      UI.showToast('Status posted', 'success');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  openStatusViewer(statuses) {
    const modal = document.getElementById('statusViewerModal');
    const viewer = document.getElementById('statusViewer');
    if (!modal || !viewer || !statuses || !statuses.length) return;

    let index = 0;
    let timer = null;

    const stopTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const closeModal = () => {
      stopTimer();
      modal.style.display = 'none';
      modal.onclick = null;
    };

    const render = () => {
      stopTimer();
      const status = statuses[index];
      viewer.style.background = status.background || '#075E54';

      let mediaHtml = '';
      if (status.type === 'image' || (status.media_url && status.media_url.includes('/images/'))) {
        mediaHtml = `<div style="max-height:60vh; width:100%; display:flex; align-items:center; justify-content:center; margin:12px 0;">
          <img src="${status.media_url}" style="max-height:55vh; max-width:100%; object-fit:contain; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.5);" alt="Status Image" />
        </div>`;
      } else if (status.type === 'video' || (status.media_url && status.media_url.includes('/videos/'))) {
        mediaHtml = `<div style="max-height:60vh; width:100%; display:flex; align-items:center; justify-content:center; margin:12px 0;">
          <video src="${status.media_url}" autoplay controls style="max-height:55vh; max-width:100%; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.5);"></video>
        </div>`;
      } else if (status.type === 'audio' || (status.media_url && status.media_url.includes('/audio/'))) {
        mediaHtml = `<div style="width:100%; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:12px 0; background:rgba(0,0,0,0.2); border-radius:12px;">
          <span style="font-size:36px; margin-bottom:12px;">🎵</span>
          <audio src="${status.media_url}" autoplay controls style="width:90%;"></audio>
        </div>`;
      }

      viewer.innerHTML = `
        <button class="status-viewer-close" type="button" title="Close">✕</button>
        <div class="status-viewer-progress">${statuses.map((_, itemIndex) => `<span class="${itemIndex <= index ? 'seen' : ''}"></span>`).join('')}</div>
        <div class="status-viewer-author">${escapeHTML(status.display_name)} · ${UI.formatTime(status.created_at)}</div>
        ${mediaHtml}
        ${status.content ? `<div class="status-viewer-text">${escapeHTML(status.content)}</div>` : ''}
        ${index > 0 ? '<button class="status-nav status-prev" type="button" title="Previous">‹</button>' : ''}
        ${index < statuses.length - 1 ? '<button class="status-nav status-next" type="button" title="Next">›</button>' : ''}
      `;

      const closeBtn = viewer.querySelector('.status-viewer-close');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          closeModal();
        };
      }

      const prevBtn = viewer.querySelector('.status-prev');
      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          index -= 1;
          render();
        };
      }

      const nextBtn = viewer.querySelector('.status-next');
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          index += 1;
          render();
        };
      }

      // Auto advance status (8s for video/audio, 5s for text/image)
      const duration = (status.type === 'video' || status.type === 'audio') ? 10000 : 5000;
      timer = setTimeout(() => {
        if (index < statuses.length - 1) {
          index += 1;
          render();
        } else {
          closeModal();
        }
      }, duration);
    };

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    modal.style.display = 'flex';
    render();
  },

  renderChatList(chatsToRender) {
    const listEl = document.getElementById('chatList');
    if (!listEl) return;

    if (!chatsToRender || chatsToRender.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 30px; text-align:center; color:var(--text-muted); font-size:14px;">
          No chats yet. Start a new conversation!
        </div>
      `;
      return;
    }

    listEl.innerHTML = chatsToRender.map(c => {
      const isGroup = c.type === 'group';
      const name = isGroup ? c.group?.name : c.other_user?.name;
      const avatar = isGroup ? (c.group?.avatar ? `/uploads/${c.group.avatar}` : null) : (c.other_user?.avatar ? `/uploads/${c.other_user.avatar}` : null);
      const isOnline = !isGroup && c.other_user?.is_online;
      const unread = c.unread_count > 0 ? `<div class="unread-badge">${c.unread_count}</div>` : '';
      const lastMsg = c.last_message ? (c.last_message.type === 'text' ? escapeHTML(c.last_message.content) : `[${c.last_message.type}]`) : 'No messages yet';
      const time = c.last_message ? UI.formatTime(c.last_message.created_at) : '';

      return `
        <div class="chat-item ${c.id === this.currentChatId ? 'active' : ''}" onclick="chatApp.openChat('${c.id}')" id="chat-item-${c.id}">
          <div class="chat-item-avatar">
            ${UI.renderAvatar(avatar, name)}
            ${isOnline ? '<span class="status-indicator online"></span>' : ''}
          </div>
          <div class="chat-item-content">
            <div class="chat-item-top">
              <div class="chat-item-name">${escapeHTML(name || 'Chat')}</div>
              <div class="chat-item-time">${time}</div>
            </div>
            <div class="chat-item-bottom">
              <div class="chat-item-preview">${lastMsg}</div>
              ${unread}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  async openChat(chatId) {
    this.currentChatId = chatId;
    document.getElementById('chatAppRoot')?.classList.add('chat-open');
    socketClient.joinChat(chatId);

    // Update active highlight in sidebar
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`chat-item-${chatId}`);
    if (item) item.classList.add('active');

    // Switch view from empty state to active chat
    const emptyState = document.getElementById('emptyState');
    const chatArea = document.getElementById('chatArea');
    if (emptyState) emptyState.style.display = 'none';
    if (chatArea) chatArea.style.display = 'flex';

    // Get chat metadata
    try {
      const res = await api.get(`/chats/${chatId}`);
      if (res.success && res.data) {
        this.currentChat = res.data;
        this.renderChatHeader(this.currentChat);
      }
    } catch (e) {
      console.error(e);
    }

    // Load message history
    await this.loadMessages(chatId);
  },

  renderChatHeader(chat) {
    const isGroup = chat.type === 'group';
    const name = isGroup ? chat.group_name : (chat.members?.find(m => m.id !== this.currentUser.id)?.display_name);
    const avatar = isGroup ? (chat.group_avatar ? `/uploads/${chat.group_avatar}` : null) : (chat.members?.find(m => m.id !== this.currentUser.id)?.avatar ? `/uploads/${chat.members.find(m => m.id !== this.currentUser.id).avatar}` : null);
    const otherUser = !isGroup ? chat.members?.find(m => m.id !== this.currentUser.id) : null;

    const avatarContainer = document.getElementById('chatHeaderAvatar');
    if (avatarContainer) {
      avatarContainer.innerHTML = UI.renderAvatar(avatar, name);
    }

    const nameEl = document.getElementById('chatHeaderName');
    if (nameEl) nameEl.innerText = name || 'Chat';

    const statusEl = document.getElementById('chatHeaderStatus');
    if (statusEl) {
      if (isGroup) {
        statusEl.innerText = `${chat.members?.length || 0} members`;
      } else if (otherUser) {
        statusEl.innerText = otherUser.is_online ? 'online' : (otherUser.last_seen ? `last seen ${UI.formatTime(otherUser.last_seen)}` : 'offline');
      }
    }
  },

  async loadMessages(chatId) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading messages...</div>`;

    try {
      const res = await api.get(`/messages/chats/${chatId}/messages?limit=100`);
      if (res.success && res.data) {
        container.innerHTML = '';
        res.data.forEach(msg => {
          container.innerHTML += messageRenderer.renderBubble(msg, this.currentUser.id);
        });
        this.scrollToBottom();
      }
    } catch (err) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Error loading messages</div>`;
    }
  },

  appendMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.innerHTML += messageRenderer.renderBubble(msg, this.currentUser.id);
    }
  },

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input?.value?.trim();
    if (!content) return;

    input.value = '';
    socketClient.sendTypingStop(this.currentChatId);

    const payload = {
      chatId: this.currentChatId,
      type: 'text',
      content,
      reply_to_id: this.replyingToMessage ? this.replyingToMessage.id : null,
    };

    this.clearReply();

    socketClient.sendMessage(payload, (res) => {
      if (!res.success) {
        UI.showToast(res.message || 'Failed to send message', 'error');
      }
    });
  },

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    UI.showToast('Uploading file...', 'info');

    try {
      const uploadRes = await mediaManager.uploadFile(file);

      const payload = {
        chatId: this.currentChatId,
        type: uploadRes.message_type,
        media_id: uploadRes.media_id,
        content: null,
      };

      socketClient.sendMessage(payload);
    } catch (err) {
      UI.showToast(err.message, 'error');
    } finally {
      e.target.value = '';
    }
  },

  shareLocation() {
    if (!this.currentChatId) return UI.showToast('Open a chat first', 'error');
    if (!navigator.geolocation) return UI.showToast('Location is not supported by this browser', 'error');

    UI.showToast('Getting your location...', 'info');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        socketClient.sendMessage({
          chatId: this.currentChatId,
          type: 'location',
          content: JSON.stringify({ latitude, longitude }),
        }, (res) => {
          if (!res?.success) UI.showToast(res?.message || 'Failed to share location', 'error');
        });
      },
      (error) => UI.showToast(`Could not get location: ${error.message}`, 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  },

  async startRecording() {
    const recordingBar = document.getElementById('voiceRecordingBar');
    const timerEl = document.getElementById('recordingTimer');

    if (recordingBar) recordingBar.style.display = 'flex';

    await mediaManager.startVoiceRecording(
      (time) => { if (timerEl) timerEl.innerText = time; },
      (err) => {
        UI.showToast('Could not record: ' + err, 'error');
        if (recordingBar) recordingBar.style.display = 'none';
      }
    );
  },

  async stopAndSendRecording() {
    const recordingBar = document.getElementById('voiceRecordingBar');
    if (recordingBar) recordingBar.style.display = 'none';

    try {
      const { blob, duration } = await mediaManager.stopVoiceRecording();
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

      UI.showToast('Sending voice note...', 'info');
      const uploadRes = await mediaManager.uploadFile(file);

      socketClient.sendMessage({
        chatId: this.currentChatId,
        type: 'voice',
        media_id: uploadRes.media_id,
        duration,
      });
    } catch (err) {
      UI.showToast('Failed to send voice note', 'error');
    }
  },

  cancelRecording() {
    mediaManager.cancelVoiceRecording();
    const recordingBar = document.getElementById('voiceRecordingBar');
    if (recordingBar) recordingBar.style.display = 'none';
  },

  async openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    if (!modal || !video) return;

    try {
      modal.style.display = 'flex';
      await mediaManager.startCamera(video);
    } catch (err) {
      modal.style.display = 'none';
      UI.showToast(err.message, 'error');
    }
  },

  closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    mediaManager.stopCamera(video);
    if (modal) modal.style.display = 'none';
  },

  async captureCameraPhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    if (!video || !canvas) return;

    const file = await mediaManager.capturePhoto(video, canvas);
    this.closeCamera();
    if (file) {
      await this.handleFileUpload({ target: { files: [file], value: '' } });
    }
  },

  setReplyMessage(msgId) {
    const row = document.getElementById(`msg-${msgId}`);
    if (!row) return;

    this.replyingToMessage = { id: msgId };
    const replyBar = document.getElementById('replyPreviewBar');
    const replyText = document.getElementById('replyPreviewText');

    if (replyBar && replyText) {
      replyText.innerText = row.innerText.substring(0, 80);
      replyBar.style.display = 'flex';
    }
  },

  clearReply() {
    this.replyingToMessage = null;
    const replyBar = document.getElementById('replyPreviewBar');
    if (replyBar) replyBar.style.display = 'none';
  },

  handleTypingEmit() {
    socketClient.sendTypingStart(this.currentChatId);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      socketClient.sendTypingStop(this.currentChatId);
    }, 2000);
  },

  showTypingIndicator(show) {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = show ? 'flex' : 'none';
    if (show) this.scrollToBottom();
  },

  markMessagesAsReadInDOM(messageIds) {
    if (Array.isArray(messageIds)) {
      messageIds.forEach(id => {
        const tick = document.querySelector(`#msg-${id} .tick-icon`);
        if (tick) {
          tick.className = 'tick-icon tick-read';
        }
      });
    }
  },

  updateChatInList(chatId, lastMsg) {
    const item = document.getElementById(`chat-item-${chatId}`);
    if (item) {
      const previewEl = item.querySelector('.chat-item-preview');
      const timeEl = item.querySelector('.chat-item-time');
      if (previewEl) previewEl.innerText = lastMsg.type === 'text' ? lastMsg.content : `[${lastMsg.type}]`;
      if (timeEl) timeEl.innerText = UI.formatTime(lastMsg.created_at);
    } else {
      this.loadChats();
    }
  },

  updateUserPresenceUI(data) {
    if (this.currentChat && this.currentChat.type === 'direct') {
      const other = this.currentChat.members?.find(m => m.id === data.userId);
      if (other) {
        const statusEl = document.getElementById('chatHeaderStatus');
        if (statusEl) {
          statusEl.innerText = data.is_online ? 'online' : (data.last_seen ? `last seen ${UI.formatTime(data.last_seen)}` : 'offline');
        }
      }
    }
  },

  initiateCall(type) {
    if (!this.currentChat) return;
    const targetUser = this.currentChat.members?.find(m => m.id !== this.currentUser.id);
    if (!targetUser) {
      return UI.showToast('Cannot call in this conversation', 'error');
    }
    webrtcCall.startCall(targetUser.id, this.currentChatId, type);
  },

  toggleEmojiPicker() {
    let picker = document.getElementById('customEmojiPicker');
    if (picker) {
      picker.remove();
      return;
    }

    const emojis = ['😊','😂','❤️','👍','🎉','🔥','😍','🤔','🙏','👋','🙌','😎','🥳','✨','🌟','💯','😢','😭','😱','😡','👏','💪','👀','🚀','🍕','🍔','☕','🍻','🌮','🍰','🌈','🏖️'];

    picker = document.createElement('div');
    picker.id = 'customEmojiPicker';
    picker.className = 'emoji-picker-container';

    emojis.forEach(emoji => {
      const item = document.createElement('span');
      item.className = 'emoji-item';
      item.innerText = emoji;
      item.onclick = () => {
        const input = document.getElementById('messageInput');
        if (input) input.value += emoji;
        picker.remove();
      };
      picker.appendChild(item);
    });

    const chatInputArea = document.querySelector('.chat-input-container');
    if (chatInputArea) {
      chatInputArea.appendChild(picker);
    }
  },

  handleSearchInput(val) {
    if (!val || val.trim().length === 0) {
      this.renderChatList(this.chats);
      return;
    }

    const lower = val.toLowerCase();
    const filtered = this.chats.filter(c => {
      const name = c.type === 'group' ? c.group?.name : c.other_user?.name;
      return name && name.toLowerCase().includes(lower);
    });
    this.renderChatList(filtered);
  },

  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  exportChat() {
    if (!this.currentChatId) return UI.showToast('Open a conversation to export', 'error');

    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.message-row');
    if (rows.length === 0) return UI.showToast('No messages to export', 'info');

    let transcript = `==================================================\n`;
    transcript += `ChatFlow Export - Transcript\n`;
    transcript += `Exported at: ${new Date().toLocaleString()}\n`;
    transcript += `==================================================\n\n`;

    rows.forEach(row => {
      const isSent = row.classList.contains('sent');
      const sender = row.querySelector('.message-sender-title')?.innerText || (isSent ? 'You' : 'Contact');
      const time = row.querySelector('.message-meta span')?.innerText || '';
      const bubble = row.querySelector('.message-bubble');
      const text = bubble ? bubble.innerText.replace(/\n\d{1,2}:\d{2}.*$/, '').trim() : '';

      transcript += `[${time}] ${sender}: ${text}\n`;
    });

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ChatFlow-Export-${this.currentChatId.substring(0, 8)}.txt`;
    link.click();
    UI.showToast('Chat transcript exported successfully', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  chatApp.init();
});
