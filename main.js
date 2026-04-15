const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');
const extract = require('extract-zip');

const activeDownloads = new Set();

const GAME_URL = "https://www.dropbox.com/scl/fi/dxz82r2igo2uqwatwkrjn/Momo.zip?rlkey=5ruwd7744z36gz74wnlo5dhjz&e=1&st=e8ns2tqy&dl=1";
const BEPINEX_URL = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x86_5.4.23.5.zip";

const userDataPath = app.getPath('userData'); 
const instancesDir = path.join(userDataPath, 'Instances');
const stateFilePath = path.join(userDataPath, 'state.json');

function getPaths(state) {
    const instancePath = path.join(instancesDir, state.activeInstance);
    return {
        instancePath,
        gameExePath: path.join(instancePath, 'Momo.exe'),
        bepinexPluginsDir: path.join(instancePath, 'BepInEx', 'plugins')
    };
}

function loadState() {
    if (fs.existsSync(stateFilePath)) {
        let state = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
        
        if (state.profiles) {
            const newState = { instances: {}, activeInstance: state.activeProfile || "Default" };
            newState.instances["Default"] = {
                gameInstalled: state.gameInstalled || false,
                bepinexInstalled: state.bepinexInstalled || false,
                installedMods: state.installedMods || {},
                playtime: state.playtime || 0
            };
            return newState;
        }
        return state;
    }
    return { 
        instances: { "Default": { gameInstalled: false, bepinexInstalled: false, installedMods: {}, playtime: 0 } }, 
        activeInstance: "Default" 
    };
}

function saveState(state) { fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2)); }

Menu.setApplicationMenu(null)

function createWindow() {
    const win = new BrowserWindow({
        width: 1050, height: 700,
        icon: path.join(__dirname, 'images', 'logo.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    win.loadFile('index.html');

    win.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });

    autoUpdater.on('update-downloaded', () => {
        win.webContents.send('update-downloaded');
    });
}

app.whenReady().then(createWindow);

ipcMain.handle('get-state', () => loadState());

ipcMain.handle('open-mods-folder', () => {
    let state = loadState();
    const { bepinexPluginsDir } = getPaths(state);
    if (fs.existsSync(bepinexPluginsDir)) {
        shell.openPath(bepinexPluginsDir);
        return { success: true };
    }
    return { success: false };
});

let gameStartTime = 0;
ipcMain.on('launch-game', (event) => {
    let state = loadState();
    const { gameExePath } = getPaths(state);
    
    if (fs.existsSync(gameExePath)) {
        gameStartTime = Date.now();
        const game = spawn(gameExePath, [], { detached: false });
        game.on('exit', () => {
            let freshState = loadState();
            freshState.instances[freshState.activeInstance].playtime += (Date.now() - gameStartTime);
            saveState(freshState);
            event.sender.send('game-closed', freshState.instances[freshState.activeInstance].playtime);
        });
    }
});

ipcMain.handle('install-game', async (event, targetInstance) => {
    if (activeDownloads.has(targetInstance)) return { success: false, error: "Already downloading!" };
    activeDownloads.add(targetInstance);

    try {
        let state = loadState();
        const instancePath = path.join(instancesDir, targetInstance);
        if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir, { recursive: true });

        const tempZipPath = path.join(app.getPath('temp'), `MomoGame_${targetInstance}.zip`);
        const response = await axios({ url: GAME_URL, method: 'GET', responseType: 'stream' });

        const totalLength = parseInt(response.headers['content-length'], 10);
        let downloadedLength = 0;
        const writer = fs.createWriteStream(tempZipPath);

        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            if (totalLength) {
                const percent = Math.round((downloadedLength / totalLength) * 100);
                event.sender.send('download-progress', { instance: targetInstance, percent: percent });
            }
        });

        response.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

        event.sender.send('download-status', { instance: targetInstance, status: 'Extracting to instance...' });

        const safeExtractDir = path.join(instancesDir, `tempExtract_${targetInstance}`);
        await extract(tempZipPath, { dir: safeExtractDir });
        fs.unlinkSync(tempZipPath);

        const extractedMomoPath = path.join(safeExtractDir, 'Momo');
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });
        fs.renameSync(extractedMomoPath, instancePath);
        fs.rmSync(safeExtractDir, { recursive: true, force: true }); 

        let finalState = loadState();
        finalState.instances[targetInstance].gameInstalled = true;
        saveState(finalState);

        activeDownloads.delete(targetInstance);
        return { success: true };
    } catch (error) { 
        activeDownloads.delete(targetInstance);
        return { success: false, error: error.message }; 
    }
});

ipcMain.handle('uninstall-game', async () => {
    try {
        let state = loadState();
        const { instancePath } = getPaths(state);
        
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });
        
        state.instances[state.activeInstance].gameInstalled = false;
        state.instances[state.activeInstance].bepinexInstalled = false;
        state.instances[state.activeInstance].installedMods = {};
        
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-bepinex', async () => {
    try {
        let state = loadState();
        const { instancePath } = getPaths(state);

        const tempZipPath = path.join(app.getPath('temp'), 'BepInEx.zip');
        const response = await axios({ url: BEPINEX_URL, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(tempZipPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

        await extract(tempZipPath, { dir: instancePath });
        fs.unlinkSync(tempZipPath);

        state.instances[state.activeInstance].bepinexInstalled = true;
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('uninstall-bepinex', async () => {
    try {
        let state = loadState();
        const { instancePath } = getPaths(state);
        const bepinexFolder = path.join(instancePath, 'BepInEx');
        
        if (fs.existsSync(bepinexFolder)) fs.rmSync(bepinexFolder, { recursive: true, force: true });
        
        state.instances[state.activeInstance].bepinexInstalled = false;
        state.instances[state.activeInstance].installedMods = {}; 
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-mod', async (event, modId, downloadUrl, version) => {
    try {
        let state = loadState();
        const { bepinexPluginsDir } = getPaths(state);
        const specificModDir = path.join(bepinexPluginsDir, modId);
        if (!fs.existsSync(specificModDir)) fs.mkdirSync(specificModDir, { recursive: true });

        const tempZipPath = path.join(app.getPath('temp'), `temp_${modId}.zip`);
        const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });

        const writer = fs.createWriteStream(tempZipPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

        await extract(tempZipPath, { dir: specificModDir });
        fs.unlinkSync(tempZipPath);

        state.instances[state.activeInstance].installedMods[modId] = version;
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-local-mod', async (event, filePath) => {
    try {
        let state = loadState();
        const { bepinexPluginsDir } = getPaths(state);
        const modId = "local_" + path.basename(filePath, '.zip').toLowerCase().replace(/\s+/g, '_');
        const specificModDir = path.join(bepinexPluginsDir, modId);
        if (!fs.existsSync(specificModDir)) fs.mkdirSync(specificModDir, { recursive: true });

        await extract(filePath, { dir: specificModDir });

        state.instances[state.activeInstance].installedMods[modId] = "local"; 
        saveState(state);
        return { success: true, modId: modId };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('uninstall-mod', async (event, modId) => {
    try {
        let state = loadState();
        const { bepinexPluginsDir } = getPaths(state);
        const modFolder = path.join(bepinexPluginsDir, modId);
        
        if (fs.existsSync(modFolder)) fs.rmSync(modFolder, { recursive: true, force: true });

        delete state.instances[state.activeInstance].installedMods[modId];
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('switch-instance', async (event, name) => {
    let state = loadState();
    if (state.instances[name]) {
        state.activeInstance = name;
        saveState(state);
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('create-instance', async (event, name) => {
    let state = loadState();
    if (state.instances[name]) return { success: false, error: "Instance exists" };
    
    state.instances[name] = { gameInstalled: false, bepinexInstalled: false, installedMods: {}, playtime: 0 };
    state.activeInstance = name;
    saveState(state);
    return { success: true };
});

ipcMain.handle('rename-instance', async (event, oldName, newName) => {
    if (activeDownloads.has(oldName)) return { success: false, error: "Cannot rename an instance while it is downloading." };
    
    let state = loadState();
    if (!state.instances[oldName]) return { success: false, error: "Instance not found." };
    if (state.instances[newName]) return { success: false, error: "An instance with that name already exists." };

    const oldPath = path.join(instancesDir, oldName);
    const newPath = path.join(instancesDir, newName);

    try {
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);

        state.instances[newName] = state.instances[oldName];
        delete state.instances[oldName];

        if (state.activeInstance === oldName) state.activeInstance = newName;
        
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('delete-instance', async (event, instanceName) => {
    if (activeDownloads.has(instanceName)) return { success: false, error: "Cannot delete an instance while it is downloading." };
    
    let state = loadState();
    
    if (Object.keys(state.instances).length <= 1) {
        return { success: false, error: "You cannot delete your only instance! Create a new one first." };
    }

    const instancePath = path.join(instancesDir, instanceName);

    try {
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });

        delete state.instances[instanceName];

        if (state.activeInstance === instanceName) {
            state.activeInstance = Object.keys(state.instances)[0];
        }
        
        saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
});