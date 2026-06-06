const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('webkita', {
  getState: () => ipcRenderer.invoke('get-state'),
  activate: (key) => ipcRenderer.invoke('activate', key),
  reset: () => ipcRenderer.invoke('reset'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  // generate now ENQUEUES a job and returns {ok,id}; progress arrives via onJobs.
  generate: (data) => ipcRenderer.invoke('generate', data),
  storyboardGenerate: (data) => ipcRenderer.invoke('storyboard-generate', data),
  photoEditorGenerate: (data) => ipcRenderer.invoke('photo-editor-generate', data),
  jobsList: () => ipcRenderer.invoke('jobs-list'),
  jobRetry: (id) => ipcRenderer.invoke('job-retry', id),
  jobRemove: (id) => ipcRenderer.invoke('job-remove', id),
  capture: () => ipcRenderer.invoke('capture'),
  // live job list pushed from main on every state change
  onJobs: (cb) => ipcRenderer.on('jobs', (_e, jobs) => cb(jobs)),
  onLog: (cb) => ipcRenderer.on('log', (_e, line) => cb(line)),
  onSessionExpired: (cb) => ipcRenderer.on('session-expired', (_e, msg) => cb(msg)),
  onLicenseWarning: (cb) => ipcRenderer.on('license-warning', (_e, msg) => cb(msg)),
});
