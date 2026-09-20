// frontend/js/media.js
// Voice recording with MediaRecorder API and media file uploading
'use strict';

const mediaManager = {
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  timerInterval: null,
  recordSeconds: 0,

  async startVoiceRecording(onTick, onError) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordSeconds = 0;

      this.timerInterval = setInterval(() => {
        this.recordSeconds++;
        const mins = Math.floor(this.recordSeconds / 60);
        const secs = this.recordSeconds % 60;
        const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (typeof onTick === 'function') onTick(formatted);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      if (typeof onError === 'function') onError(err.message);
    }
  },

  stopVoiceRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        return reject(new Error('Recorder not active'));
      }

      clearInterval(this.timerInterval);

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        // Stop all audio tracks to release microphone
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;
        resolve({ blob: audioBlob, duration: this.recordSeconds });
      };

      this.mediaRecorder.stop();
    });
  },

  cancelVoiceRecording() {
    if (this.mediaRecorder && this.isRecording) {
      clearInterval(this.timerInterval);
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      this.audioChunks = [];
    }
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.upload('/media/upload', formData);
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.message || 'Media upload failed');
  },

  cameraStream: null,

  async startCamera(videoElement) {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoElement.srcObject = this.cameraStream;
      await videoElement.play();
    } catch (err) {
      console.error('Camera access error:', err);
      throw new Error('Could not access camera: ' + err.message);
    }
  },

  capturePhoto(videoElement, canvasElement) {
    if (!videoElement || !this.cameraStream) return null;

    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    const ctx = canvasElement.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    return new Promise((resolve) => {
      canvasElement.toBlob((blob) => {
        this.stopCamera(videoElement);
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          resolve(file);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.92);
    });
  },

  stopCamera(videoElement) {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }
};

