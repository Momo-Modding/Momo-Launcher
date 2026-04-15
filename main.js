const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { spawn } = require('child_process');
const axios = require('axios');
const extract = require('extract-zip');
const crypto = require('crypto');

const activeDownloads = new Set();
const activeGames = {};
const DB_URL = "https://raw.githubusercontent.com/Momo-Modding/Momo-Mod-Database/main/mods.json";

const DEFAULT_GAME_URL = "https://www.dropbox.com/scl/fi/dxz82r2igo2uqwatwkrjn/Momo.zip?rlkey=5ruwd7744z36gz74wnlo5dhjz&e=1&st=e8ns2tqy&dl=1";
const DEFAULT_BEPINEX_URL = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x86_5.4.23.5.zip";

const userDataPath = app.getPath('userData'); 
const instancesDir = path.join(userDataPath, 'Instances');
const stateFilePath = path.join(userDataPath, 'state.json');

let isSaving = false;
let pendingSave = false;
let pendingState = null;

function getPaths(state) {
    const instancePath = path.join(instancesDir, state.activeInstance);
    return {
        instancePath,
        gameExePath: path.join(instancePath, 'Momo.exe'),
        bepinexPluginsDir: path.join(instancePath, 'BepInEx', 'plugins')
    };
}

async function loadState() {
    if (fs.existsSync(stateFilePath)) {
        let state = JSON.parse(await fsp.readFile(stateFilePath, 'utf8'));
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

async function saveState(state) {
    pendingState = state;
    if (isSaving) {
        pendingSave = true;
        return;
    }
    isSaving = true;
    try {
        await fsp.writeFile(stateFilePath, JSON.stringify(pendingState, null, 2));
    } catch (error) {}
    isSaving = false;
    if (pendingSave) {
        pendingSave = false;
        saveState(pendingState);
    }
}

async function fetchConfig() {
    try {
        const res = await axios.get(DB_URL);
        return {
            gameUrl: res.data.game_url || DEFAULT_GAME_URL,
            bepinexUrl: res.data.bepinex_url || DEFAULT_BEPINEX_URL
        };
    } catch (error) {
        return { gameUrl: DEFAULT_GAME_URL, bepinexUrl: DEFAULT_BEPINEX_URL };
    }
}

function verifyFile(filePath) {
    return new Promise((resolve) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', () => resolve(null));
    });
}

Menu.setApplicationMenu(null);

function createWindow() {
    const win = new BrowserWindow({
        width: 1050, height: 700,
        icon: path.join(__dirname, 'images', 'logo.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    win.loadFile('index.html');
    win.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
        setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 14400000);
    });
    autoUpdater.on('update-downloaded', () => { win.webContents.send('update-downloaded'); });
    autoUpdater.on('error', (error) => win.webContents.send('update-error', error.message));
    ipcMain.handle('check-for-updates', async () => {
        try {
            const result = await autoUpdater.checkForUpdatesAndNotify();
            return { success: !!result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

app.whenReady().then(createWindow);
ipcMain.handle('get-state', () => loadState());

ipcMain.handle('open-mods-folder', async () => {
    let state = await loadState();
    const { bepinexPluginsDir } = getPaths(state);
    if (fs.existsSync(bepinexPluginsDir)) {
        shell.openPath(bepinexPluginsDir);
        return { success: true };
    }
    return { success: false };
});

ipcMain.on('launch-game', async (event) => {
    let state = await loadState();
    const instance = state.activeInstance;
    const { gameExePath } = getPaths(state);
    if (fs.existsSync(gameExePath) && !activeGames[instance]) {
        const game = spawn(gameExePath, [], { detached: false });
        activeGames[instance] = setInterval(async () => {
            let freshState = await loadState();
            freshState.instances[instance].playtime += 10000;
            await saveState(freshState);
            event.sender.send('playtime-update', freshState.instances[instance].playtime);
        }, 10000);
        game.on('exit', async () => {
            if (activeGames[instance]) {
                clearInterval(activeGames[instance]);
                delete activeGames[instance];
            }
            let finalState = await loadState();
            event.sender.send('game-closed', finalState.instances[instance].playtime);
        });
    }
});

ipcMain.handle('install-game', async (event, targetInstance) => {
    if (activeDownloads.has(targetInstance)) return { success: false, error: "Already downloading!" };
    activeDownloads.add(targetInstance);
    try {
        const config = await fetchConfig();
        const instancePath = path.join(instancesDir, targetInstance);
        if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir, { recursive: true });
        const tempZipPath = path.join(app.getPath('temp'), `MomoGame_${targetInstance}.zip`);
        const response = await axios({ url: config.gameUrl, method: 'GET', responseType: 'stream' });
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
        const fileHash = await verifyFile(tempZipPath);
        if (!fileHash) throw new Error("File integrity check failed.");
        event.sender.send('download-status', { instance: targetInstance, status: 'Extracting...' });
        const safeExtractDir = path.join(instancesDir, `tempExtract_${targetInstance}`);
        await extract(tempZipPath, { dir: safeExtractDir });
        fs.unlinkSync(tempZipPath);
        const extractedMomoPath = path.join(safeExtractDir, 'Momo');
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });
        fs.renameSync(extractedMomoPath, instancePath);
        fs.rmSync(safeExtractDir, { recursive: true, force: true }); 
        let finalState = await loadState();
        finalState.instances[targetInstance].gameInstalled = true;
        await saveState(finalState);
        activeDownloads.delete(targetInstance);
        return { success: true };
    } catch (error) { 
        activeDownloads.delete(targetInstance);
        return { success: false, error: error.message }; 
    }
});

ipcMain.handle('uninstall-game', async () => {
    try {
        let state = await loadState();
        const { instancePath } = getPaths(state);
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });
        state.instances[state.activeInstance].gameInstalled = false;
        state.instances[state.activeInstance].bepinexInstalled = false;
        state.instances[state.activeInstance].installedMods = {};
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-bepinex', async () => {
    try {
        const config = await fetchConfig();
        let state = await loadState();
        const { instancePath } = getPaths(state);
        const tempZipPath = path.join(app.getPath('temp'), 'BepInEx.zip');
        const response = await axios({ url: config.bepinexUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(tempZipPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
        await extract(tempZipPath, { dir: instancePath });
        fs.unlinkSync(tempZipPath);
        state.instances[state.activeInstance].bepinexInstalled = true;
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('uninstall-bepinex', async () => {
    try {
        let state = await loadState();
        const { instancePath } = getPaths(state);
        const bepinexFolder = path.join(instancePath, 'BepInEx');
        if (fs.existsSync(bepinexFolder)) fs.rmSync(bepinexFolder, { recursive: true, force: true });
        state.instances[state.activeInstance].bepinexInstalled = false;
        state.instances[state.activeInstance].installedMods = {}; 
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-mod', async (event, modId, downloadUrl, version) => {
    try {
        let state = await loadState();
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
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('install-local-mod', async (event, filePath) => {
    try {
        let state = await loadState();
        const { bepinexPluginsDir } = getPaths(state);
        const modId = "local_" + path.basename(filePath, '.zip').toLowerCase().replace(/\s+/g, '_');
        const specificModDir = path.join(bepinexPluginsDir, modId);
        if (!fs.existsSync(specificModDir)) fs.mkdirSync(specificModDir, { recursive: true });
        await extract(filePath, { dir: specificModDir });
        state.instances[state.activeInstance].installedMods[modId] = "local"; 
        await saveState(state);
        return { success: true, modId: modId };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('uninstall-mod', async (event, modId) => {
    try {
        let state = await loadState();
        const { bepinexPluginsDir } = getPaths(state);
        const modFolder = path.join(bepinexPluginsDir, modId);
        if (fs.existsSync(modFolder)) fs.rmSync(modFolder, { recursive: true, force: true });
        delete state.instances[state.activeInstance].installedMods[modId];
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('switch-instance', async (event, name) => {
    let state = await loadState();
    if (state.instances[name]) {
        state.activeInstance = name;
        await saveState(state);
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('create-instance', async (event, name) => {
    let state = await loadState();
    if (state.instances[name]) return { success: false, error: "Instance exists" };
    state.instances[name] = { gameInstalled: false, bepinexInstalled: false, installedMods: {}, playtime: 0 };
    state.activeInstance = name;
    await saveState(state);
    return { success: true };
});

ipcMain.handle('rename-instance', async (event, oldName, newName) => {
    if (activeDownloads.has(oldName)) return { success: false, error: "Cannot rename an instance while it is downloading." };
    let state = await loadState();
    if (!state.instances[oldName]) return { success: false, error: "Instance not found." };
    if (state.instances[newName]) return { success: false, error: "An instance with that name already exists." };
    const oldPath = path.join(instancesDir, oldName);
    const newPath = path.join(instancesDir, newName);
    try {
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
        state.instances[newName] = state.instances[oldName];
        delete state.instances[oldName];
        if (state.activeInstance === oldName) state.activeInstance = newName;
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('delete-instance', async (event, instanceName) => {
    if (activeDownloads.has(instanceName)) return { success: false, error: "Cannot delete while downloading." };
    let state = await loadState();
    if (Object.keys(state.instances).length <= 1) return { success: false, error: "Create a new one first." };
    const instancePath = path.join(instancesDir, instanceName);
    try {
        if (fs.existsSync(instancePath)) fs.rmSync(instancePath, { recursive: true, force: true });
        delete state.instances[instanceName];
        if (state.activeInstance === instanceName) state.activeInstance = Object.keys(state.instances)[0];
        await saveState(state);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.on('restart-app', () => autoUpdater.quitAndInstall(false, true));