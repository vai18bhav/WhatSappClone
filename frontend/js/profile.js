// frontend/js/profile.js
// Profile editing and avatar preview
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth();

  const nameInput = document.getElementById('profileName');
  const emailInput = document.getElementById('profileEmail');
  const phoneInput = document.getElementById('profilePhone');
  const bioInput = document.getElementById('profileBio');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarInput = document.getElementById('avatarFileInput');

  try {
    const res = await api.get('/auth/me');
    if (res.success && res.data) {
      const user = res.data;
      if (nameInput) nameInput.value = user.display_name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (phoneInput) phoneInput.value = user.phone || '';
      if (bioInput) bioInput.value = user.bio || '';
      if (avatarImg) {
        if (user.avatar) {
          avatarImg.src = `/uploads/${user.avatar}`;
          avatarImg.style.display = 'block';
        } else {
          avatarImg.style.display = 'none';
        }
      }
    }
  } catch (err) {
    UI.showToast(err.message, 'error');
  }

  // Image preview
  if (avatarInput) {
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          if (avatarImg) {
            avatarImg.src = re.target.result;
            avatarImg.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Save profile
  const form = document.getElementById('profileForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('display_name', nameInput.value);
      formData.append('phone', phoneInput.value);
      formData.append('bio', bioInput.value);
      if (avatarInput && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
      }

      try {
        const res = await api.upload('/users/profile', formData);
        if (res.success && res.data) {
          auth.setUser(res.data);
          if (res.data.avatar && avatarImg) {
            avatarImg.src = `/uploads/${res.data.avatar}?t=${Date.now()}`;
            avatarImg.style.display = 'block';
          }
          UI.showToast('Profile updated successfully', 'success');
        }
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });
  }
});
