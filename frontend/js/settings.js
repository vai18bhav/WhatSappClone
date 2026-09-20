// frontend/js/settings.js
// Settings configuration logic
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();

  const themeSelect = document.getElementById('themeSelect');
  const currentTheme = localStorage.getItem('chatflow_theme') || 'light';
  if (themeSelect) {
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-theme', e.target.value);
      localStorage.setItem('chatflow_theme', e.target.value);
    });
  }

  // Load user privacy settings
  loadUserSettings();

  const privacyForm = document.getElementById('privacyForm');
  if (privacyForm) {
    privacyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const lastSeen = document.getElementById('privacyLastSeen').value;
        const profilePhoto = document.getElementById('privacyProfilePhoto').value;
        const about = document.getElementById('privacyAbout').value;

        await api.put('/users/profile', {
          privacy_last_seen: lastSeen,
          privacy_profile_photo: profilePhoto,
          privacy_about: about
        });

        UI.showToast('Privacy settings saved', 'success');
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }

  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (newPassword !== confirmPassword) {
        return UI.showToast('New passwords do not match', 'error');
      }

      try {
        await api.put('/auth/change-password', { currentPassword, newPassword });
        UI.showToast('Password changed successfully', 'success');
        passwordForm.reset();
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }
});

async function loadUserSettings() {
  try {
    const res = await api.get('/auth/me');
    if (res.success && res.data) {
      const u = res.data;
      if (document.getElementById('privacyLastSeen')) {
        document.getElementById('privacyLastSeen').value = u.privacy_last_seen || 'everyone';
      }
      if (document.getElementById('privacyProfilePhoto')) {
        document.getElementById('privacyProfilePhoto').value = u.privacy_profile_photo || 'everyone';
      }
      if (document.getElementById('privacyAbout')) {
        document.getElementById('privacyAbout').value = u.privacy_about || 'everyone';
      }
    }
  } catch (err) {
    console.error('Error loading user settings:', err);
  }
}
