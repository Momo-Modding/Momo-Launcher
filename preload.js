const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    launchGame: () => ipcRenderer.send('launch-game'),
    installGame: (instanceName) => ipcRenderer.invoke('install-game', instanceName),
    uninstallGame: () => ipcRenderer.invoke('uninstall-game'), 
    
    installBepInEx: () => ipcRenderer.invoke('install-bepinex'),
    uninstallBepInEx: () => ipcRenderer.invoke('uninstall-bepinex'),
    installMod: (modId, url, version) => ipcRenderer.invoke('install-mod', modId, url, version),
    uninstallMod: (modId) => ipcRenderer.invoke('uninstall-mod', modId),
    openModsFolder: () => ipcRenderer.invoke('open-mods-folder'),
    
    installLocalMod: (file) => {
        const filePath = webUtils.getPathForFile(file);
        return ipcRenderer.invoke('install-local-mod', filePath);
    },
    
    switchInstance: (name) => ipcRenderer.invoke('switch-instance', name),
    createInstance: (name) => ipcRenderer.invoke('create-instance', name),
    renameInstance: (oldName, newName) => ipcRenderer.invoke('rename-instance', oldName, newName),
    deleteInstance: (name) => ipcRenderer.invoke('delete-instance', name),

    getState: () => ipcRenderer.invoke('get-state'),
    
    onGameClosed: (callback) => ipcRenderer.on('game-closed', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onDownloadStatus: (callback) => ipcRenderer.on('download-status', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    restartApp: () => ipcRenderer.send('restart-app')
});