// frontend/js/group.js
// Group conversation creation, member controls, and administration
'use strict';

const groupManager = {
  async createGroup(name, description, memberIds, avatarFile) {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    memberIds.forEach(id => formData.append('members[]', id));
    if (avatarFile) formData.append('avatar', avatarFile);

    const res = await api.upload('/groups', formData);
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.message || 'Failed to create group');
  },

  async getGroupDetails(groupId) {
    const res = await api.get(`/groups/${groupId}`);
    return res.data;
  },

  async addMember(groupId, userId) {
    return await api.post(`/groups/${groupId}/members`, { members: [userId] });
  },

  async removeMember(groupId, userId) {
    return await api.delete(`/groups/${groupId}/members/${userId}`);
  },

  async leaveGroup(groupId) {
    return await api.post(`/groups/${groupId}/leave`, {});
  },

  async promoteToAdmin(groupId, userId) {
    return await api.put(`/groups/${groupId}/members/${userId}/promote`, {});
  },

  async demoteFromAdmin(groupId, userId) {
    return await api.put(`/groups/${groupId}/members/${userId}/demote`, {});
  }
};
