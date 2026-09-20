// frontend/js/call.js
// WebRTC Voice & Video calling system with Socket.IO signaling
'use strict';

const webrtcCall = {
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  activeCallId: null,
  activeChatId: null,
  targetUserId: null,
  callType: 'voice',
  callTimerInterval: null,
  callSeconds: 0,

  servers: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  },

  init(socket) {
    if (!socket) return;

    // Listen for incoming call offer
    socket.on('incoming_call', (data) => {
      this.handleIncomingCall(data);
    });

    // Listen for call answered
    socket.on('call_answered', async (data) => {
      if (this.peerConnection && data.sdpAnswer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
        this.startCallTimer();
        const statusEl = document.getElementById('callStatusText');
        if (statusEl) statusEl.innerText = 'Connected';
      }
    });

    // Listen for ICE candidate
    socket.on('ice_candidate', async (data) => {
      if (this.peerConnection && data.candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    // Listen for call rejection
    socket.on('call_rejected', () => {
      UI.showToast('Call declined', 'info');
      this.closeCallUI();
      this.cleanup();
    });

    // Listen for call end
    socket.on('call_ended', () => {
      UI.showToast('Call ended', 'info');
      this.closeCallUI();
      this.cleanup();
    });
  },

  async startCall(targetUserId, chatId, type = 'voice') {
    this.callType = type;
    this.targetUserId = targetUserId;
    this.activeChatId = chatId;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      this.peerConnection = new RTCPeerConnection(this.servers);
      this.remoteStream = new MediaStream();

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream tracks
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.getSocket().emit('ice_candidate', {
            targetId: this.targetUserId,
            candidate: event.candidate,
            callId: this.activeCallId
          });
        }
      };

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Render outgoing call UI
      this.renderCallUI({
        name: 'Calling...',
        type,
        isIncoming: false
      });

      // Send offer through socket
      socketClient.getSocket().emit('call_offer', {
        calleeId: targetUserId,
        chatId,
        type,
        sdpOffer: offer
      });

    } catch (err) {
      console.error('Call failed to start:', err);
      UI.showToast('Could not access microphone/camera', 'error');
      this.cleanup();
    }
  },

  handleIncomingCall(data) {
    this.activeCallId = data.callId;
    this.activeChatId = data.chatId;
    this.targetUserId = data.caller.id;
    this.callType = data.type;
    this.pendingOffer = data.sdpOffer;

    this.renderCallUI({
      name: data.caller.display_name || 'Caller',
      avatar: data.caller.avatar,
      type: data.type,
      isIncoming: true
    });
  },

  async acceptCall() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.callType === 'video'
      });

      this.peerConnection = new RTCPeerConnection(this.servers);
      this.remoteStream = new MediaStream();

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.getSocket().emit('ice_candidate', {
            targetId: this.targetUserId,
            candidate: event.candidate,
            callId: this.activeCallId
          });
        }
      };

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      socketClient.getSocket().emit('call_answer', {
        callId: this.activeCallId,
        callerId: this.targetUserId,
        sdpAnswer: answer
      });

      // Update call overlay UI to active
      const actionsEl = document.getElementById('callActionsContainer');
      if (actionsEl) {
        actionsEl.innerHTML = `
          <button class="call-btn mute" id="callMuteBtn" onclick="webrtcCall.toggleMute()">🎤</button>
          <button class="call-btn end" onclick="webrtcCall.endCall()">📞</button>
        `;
      }

      this.attachStreamsToUI();
      this.startCallTimer();

      const statusEl = document.getElementById('callStatusText');
      if (statusEl) statusEl.innerText = 'Connected';

    } catch (err) {
      console.error('Failed to accept call:', err);
      UI.showToast('Failed to connect call', 'error');
      this.rejectCall();
    }
  },

  rejectCall() {
    socketClient.getSocket().emit('call_reject', {
      callId: this.activeCallId,
      callerId: this.targetUserId
    });
    this.closeCallUI();
    this.cleanup();
  },

  endCall() {
    socketClient.getSocket().emit('call_end', {
      callId: this.activeCallId,
      targetId: this.targetUserId,
      durationSeconds: this.callSeconds
    });
    this.closeCallUI();
    this.cleanup();
  },

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const muteBtn = document.getElementById('callMuteBtn');
        if (muteBtn) {
          muteBtn.style.opacity = audioTrack.enabled ? '1' : '0.5';
        }
      }
    }
  },

  startCallTimer() {
    this.callSeconds = 0;
    clearInterval(this.callTimerInterval);
    this.callTimerInterval = setInterval(() => {
      this.callSeconds++;
      const mins = Math.floor(this.callSeconds / 60);
      const secs = this.callSeconds % 60;
      const statusEl = document.getElementById('callStatusText');
      if (statusEl) {
        statusEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      }
    }, 1000);
  },

  renderCallUI({ name, avatar, type, isIncoming }) {
    let overlay = document.getElementById('callOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'callOverlay';
      overlay.className = 'call-overlay';
      document.body.appendChild(overlay);
    }

    overlay.style.display = 'flex';

    if (type === 'video') {
      overlay.innerHTML = `
        <div class="call-video-container">
          <video class="remote-video" id="remoteVideo" autoplay playsinline></video>
          <video class="local-video" id="localVideo" autoplay playsinline muted></video>
        </div>
        <div style="margin-top:15px; font-size:18px; font-weight:600;">${escapeHTML(name)}</div>
        <div id="callStatusText" style="color:var(--text-muted); font-size:14px; margin-top:4px;">${isIncoming ? 'Incoming Video Call...' : 'Ringing...'}</div>
        <div class="call-controls" id="callActionsContainer">
          ${isIncoming ? `
            <button class="call-btn accept" onclick="webrtcCall.acceptCall()">📞</button>
            <button class="call-btn reject" onclick="webrtcCall.rejectCall()">✕</button>
          ` : `
            <button class="call-btn mute" id="callMuteBtn" onclick="webrtcCall.toggleMute()">🎤</button>
            <button class="call-btn end" onclick="webrtcCall.endCall()">📞</button>
          `}
        </div>
      `;
    } else {
      overlay.innerHTML = `
        <div class="call-card">
          <div class="call-avatar">${UI.renderAvatar(avatar, name)}</div>
          <div style="font-size:22px; font-weight:600;">${escapeHTML(name)}</div>
          <div id="callStatusText" style="color:var(--text-muted); font-size:14px; margin-top:8px;">${isIncoming ? 'Incoming Voice Call...' : 'Ringing...'}</div>
          <div class="call-controls" id="callActionsContainer">
            ${isIncoming ? `
              <button class="call-btn accept" onclick="webrtcCall.acceptCall()">📞</button>
              <button class="call-btn reject" onclick="webrtcCall.rejectCall()">✕</button>
            ` : `
              <button class="call-btn mute" id="callMuteBtn" onclick="webrtcCall.toggleMute()">🎤</button>
              <button class="call-btn end" onclick="webrtcCall.endCall()">📞</button>
            `}
          </div>
        </div>
      `;
    }

    if (!isIncoming) {
      this.attachStreamsToUI();
    }
  },

  attachStreamsToUI() {
    const localVid = document.getElementById('localVideo');
    if (localVid && this.localStream) {
      localVid.srcObject = this.localStream;
    }
    const remoteVid = document.getElementById('remoteVideo');
    if (remoteVid && this.remoteStream) {
      remoteVid.srcObject = this.remoteStream;
    }
  },

  closeCallUI() {
    const overlay = document.getElementById('callOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  cleanup() {
    clearInterval(this.callTimerInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.localStream = null;
    this.remoteStream = null;
    this.activeCallId = null;
    this.targetUserId = null;
  }
};
