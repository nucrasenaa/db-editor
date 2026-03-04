const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    version: process.versions.electron,
    db: {
        test: (config) => ipcRenderer.invoke('db:test', config),
        query: (args) => ipcRenderer.invoke('db:query', args),
        metadata: (config) => ipcRenderer.invoke('db:metadata', config),
        update: (args) => ipcRenderer.invoke('db:update', args),
        procSnippet: (args) => ipcRenderer.invoke('db:procedure-snippet', args),
        getDDL: (args) => ipcRenderer.invoke('db:get-ddl', args)
    }
});
