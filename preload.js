const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    launchGame: () => ipcRenderer.send('launch-game'),
    installGame: (instanceName) => ipcRenderer.invoke('install-game', instanceName),
    uninstallGame: () => ipcRenderer.invoke('uninstall-game'), 
    
    installBepInEx: () => ipcRenderer.invoke('install-bepinex'),
    uninstallBepInEx: () => ipcRenderer.invoke('uninstall-bepinex'),
    installMod: (modId, url, version) => ipcRenderer.invoke('install-mod', modId, url, version),
    uninstallMod: (modId) => ipcRenderer.invoke('uninstall-mod', modId),
    toggleMod: (modId, disable) => ipcRenderer.invoke('toggle-mod', modId, disable),
    openModsFolder: () => ipcRenderer.invoke('open-mods-folder'),
    
    installLocalMod: (file) => {
        const filePath = webUtils.getPathForFile(file);
        return ipcRenderer.invoke('install-local-mod', filePath);
    },
    
    importInstance: (file) => {
        const filePath = webUtils.getPathForFile(file);
        return ipcRenderer.invoke('import-instance', filePath);
    },
    exportInstance: (name) => ipcRenderer.invoke('export-instance', name),

    setIcon: (base64Data) => ipcRenderer.invoke('set-icon', base64Data),
    
    switchInstance: (name) => ipcRenderer.invoke('switch-instance', name),
    createInstance: (name) => ipcRenderer.invoke('create-instance', name),
    renameInstance: (oldName, newName) => ipcRenderer.invoke('rename-instance', oldName, newName),
    deleteInstance: (name) => ipcRenderer.invoke('delete-instance', name),
    getState: () => ipcRenderer.invoke('get-state'),
    
    watchLog: () => ipcRenderer.send('watch-log'),
    stopLog: () => ipcRenderer.send('stop-log'),
    onLogUpdate: (callback) => ipcRenderer.on('log-update', callback),
    onLogClear: (callback) => ipcRenderer.on('log-clear', callback),

    onGameClosed: (callback) => ipcRenderer.on('game-closed', callback),
    onPlaytimeUpdate: (callback) => ipcRenderer.on('playtime-update', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onDownloadStatus: (callback) => ipcRenderer.on('download-status', callback),
    
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
    restartApp: () => ipcRenderer.send('restart-app')
});