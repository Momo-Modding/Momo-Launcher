const playBtn = document.getElementById('play-btn');
const playGroup = document.getElementById('play-group');
const installGameBtn = document.getElementById('install-game-btn');
const uninstallGameBtn = document.getElementById('uninstall-game-btn');
const bepinexBtn = document.getElementById('bepinex-btn');
const uninstallBepinexBtn = document.getElementById('uninstall-bepinex-btn');
const checkUpdatesBtn = document.getElementById('check-updates-btn');
const modListContainer = document.getElementById('mod-list');
const playtimeText = document.getElementById('playtime-text');
const dropOverlay = document.getElementById('drop-overlay');

const customSelectContainer = document.getElementById('custom-select-container');
const instanceSelected = document.getElementById('instance-selected');
const instanceOptions = document.getElementById('instance-options');

const newInstanceBtn = document.getElementById('new-instance-btn');
const triggerImportBtn = document.getElementById('trigger-import-btn');
const exportInstanceBtn = document.getElementById('export-instance-btn');
const importZipInput = document.getElementById('import-zip-input');
const instanceIconBtn = document.getElementById('instance-icon-btn');
const iconFileInput = document.getElementById('icon-file-input');
const defaultIcon = document.getElementById('default-icon');
const customIcon = document.getElementById('custom-icon');

const tabMods = document.getElementById('tab-mods');
const tabConsole = document.getElementById('tab-console');
const viewMods = document.getElementById('view-mods');
const viewConsole = document.getElementById('view-console');

const modSearchInput = document.getElementById('mod-search-input');
const consoleOutput = document.getElementById('console-output');

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

const instanceModal = document.getElementById('instance-modal');
const instanceNameInput = document.getElementById('instance-name-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCreateBtn = document.getElementById('modal-create-btn');

const renameInstanceBtn = document.getElementById('rename-instance-btn');
const renameModal = document.getElementById('rename-modal');
const renameNameInput = document.getElementById('rename-name-input');
const renameCancelBtn = document.getElementById('rename-cancel-btn');
const renameSubmitBtn = document.getElementById('rename-submit-btn');

const deleteInstanceBtn = document.getElementById('delete-instance-btn');
const deleteModal = document.getElementById('delete-modal');
const deleteTargetName = document.getElementById('delete-target-name');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteSubmitBtn = document.getElementById('delete-submit-btn');

const alertModal = document.getElementById('alert-modal');
const alertMessageText = document.getElementById('alert-message-text');
const alertOkBtn = document.getElementById('alert-ok-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessageText = document.getElementById('confirm-message-text');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const updateModal = document.getElementById('update-modal');
const updateLaterBtn = document.getElementById('update-later-btn');
const updateRestartBtn = document.getElementById('update-restart-btn');

// Instance Stats DOM Elements
const statTotalMods = document.getElementById('stat-total-mods');
const statActiveMods = document.getElementById('stat-active-mods');
const statDisabledMods = document.getElementById('stat-disabled-mods');
const statBepinexStatus = document.getElementById('stat-bepinex-status');

let appState = null;
let githubDatabase = [];
let confirmPromiseResolve = null;

instanceSelected.addEventListener('click', () => {
    customSelectContainer.classList.toggle('open');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
        customSelectContainer.classList.remove('open');
    }
});

function showCustomAlert(message) {
    alertMessageText.innerText = message;
    alertModal.style.display = 'flex';
    setTimeout(() => alertOkBtn.focus(), 50);
}

function showCustomConfirm(message) {
    confirmMessageText.innerText = message;
    confirmModal.style.display = 'flex';
    return new Promise((resolve) => confirmPromiseResolve = resolve);
}

alertOkBtn.addEventListener('click', () => alertModal.style.display = 'none');
confirmCancelBtn.addEventListener('click', () => { confirmModal.style.display = 'none'; if (confirmPromiseResolve) confirmPromiseResolve(false); });
confirmYesBtn.addEventListener('click', () => { confirmModal.style.display = 'none'; if (confirmPromiseResolve) confirmPromiseResolve(true); });

async function syncState() {
    const backendState = await window.electronAPI.getState();
    if (appState && appState.instances) {
        Object.keys(backendState.instances).forEach(name => {
            const oldInst = appState.instances[name];
            if (oldInst && oldInst.isDownloading) {
                backendState.instances[name].isDownloading = oldInst.isDownloading;
                backendState.instances[name].downloadPercent = oldInst.downloadPercent;
                backendState.instances[name].downloadStatus = oldInst.downloadStatus;
            }
        });
    }
    appState = backendState;
}

function formatPlaytime(ms) { playtimeText.innerText = `${(ms / 3600000).toFixed(1)} hrs on record`; }
function getActiveInstance() { return appState.instances[appState.activeInstance]; }

tabMods.addEventListener('click', () => {
    tabMods.classList.add('active');
    tabConsole.classList.remove('active');
    viewMods.classList.add('active');
    viewConsole.classList.remove('active');
    window.electronAPI.stopLog();
});

tabConsole.addEventListener('click', () => {
    if (!getActiveInstance().bepinexInstalled) {
        showCustomAlert("Please install BepInEx first to view the console.");
        return;
    }
    tabConsole.classList.add('active');
    tabMods.classList.remove('active');
    viewConsole.classList.add('active');
    viewMods.classList.remove('active');
    if (playBtn.disabled) window.electronAPI.watchLog(); 
});

playBtn.addEventListener('click', () => {
    playBtn.innerText = "PLAYING...";
    playBtn.disabled = true;
    window.electronAPI.launchGame();
    if (tabConsole.classList.contains('active')) window.electronAPI.watchLog();
});

window.electronAPI.onGameClosed((e, time) => {
    playBtn.innerText = "PLAY GAME";
    playBtn.disabled = false;
    getActiveInstance().playtime = time;
    formatPlaytime(time);
    window.electronAPI.stopLog();
});

window.electronAPI.onPlaytimeUpdate((e, time) => { getActiveInstance().playtime = time; formatPlaytime(time); });

document.getElementById('open-folder-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.openModsFolder();
    if (!result.success) showCustomAlert("The mods folder doesn't exist yet! Install BepInEx first.");
});

window.electronAPI.onLogClear(() => {
    consoleOutput.innerHTML = '';
});

window.electronAPI.onLogUpdate((e, line) => {
    const div = document.createElement('div');
    div.innerText = line;
    consoleOutput.appendChild(div);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
});

iconFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const maxSize = 256; 
                
                let targetWidth = img.width;
                let targetHeight = img.height;
                
                if (targetWidth > targetHeight) {
                    if (targetWidth > maxSize) {
                        targetHeight = Math.round(targetHeight * (maxSize / targetWidth));
                        targetWidth = maxSize;
                    }
                } else {
                    if (targetHeight > maxSize) {
                        targetWidth = Math.round(targetWidth * (maxSize / targetHeight));
                        targetHeight = maxSize;
                    }
                }
                
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                
                const base64Data = canvas.toDataURL('image/png');
                
                const result = await window.electronAPI.setIcon(base64Data);
                if (result.success) {
                    await syncState();
                    updateMainUI();
                } else { 
                    showCustomAlert("Failed to set icon: " + result.error); 
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    iconFileInput.value = '';
});

instanceIconBtn.addEventListener('click', () => iconFileInput.click());

triggerImportBtn.addEventListener('click', () => importZipInput.click());
importZipInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        triggerImportBtn.disabled = true; triggerImportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Extracting...';
        const result = await window.electronAPI.importInstance(e.target.files[0]);
        triggerImportBtn.disabled = false; triggerImportBtn.innerHTML = '<i class="fa-solid fa-file-zipper" style="margin-right: 8px;"></i>Import';
        if (result.success) { await syncState(); renderInstances(); updateMainUI(); loadModsUI(); } 
        else { showCustomAlert("Failed to import instance: " + result.error); }
    }
    importZipInput.value = '';
});

exportInstanceBtn.addEventListener('click', async () => {
    const currentInstance = appState.activeInstance;
    exportInstanceBtn.disabled = true;
    exportInstanceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    const result = await window.electronAPI.exportInstance(currentInstance);
    
    exportInstanceBtn.disabled = false;
    exportInstanceBtn.innerText = "Export";
    
    if (result.success) {
        showCustomAlert("Instance exported successfully!");
    } else if (!result.canceled) {
        showCustomAlert("Failed to export instance: " + result.error);
    }
});

window.electronAPI.onDownloadProgress((e, data) => {
    const inst = appState.instances[data.instance];
    if (inst) { inst.downloadPercent = data.percent; inst.downloadStatus = `DOWNLOADING... ${data.percent}%`; }
    if (appState.activeInstance === data.instance) { progressBar.style.width = `${data.percent}%`; installGameBtn.innerText = inst.downloadStatus; }
});

window.electronAPI.onDownloadStatus((e, data) => {
    const inst = appState.instances[data.instance];
    if (inst) inst.downloadStatus = data.status;
    if (appState.activeInstance === data.instance) installGameBtn.innerText = data.status;
});

installGameBtn.addEventListener('click', async () => {
    const targetInstance = appState.activeInstance;
    appState.instances[targetInstance].isDownloading = true;
    appState.instances[targetInstance].downloadPercent = 0;
    appState.instances[targetInstance].downloadStatus = "STARTING DOWNLOAD...";
    updateMainUI();
    const result = await window.electronAPI.installGame(targetInstance);
    if (appState.instances[targetInstance]) appState.instances[targetInstance].isDownloading = false;
    if (result.success) { await syncState(); updateMainUI(); } 
    else { showCustomAlert("Failed: " + result.error); updateMainUI(); }
});

uninstallGameBtn.addEventListener('click', async () => {
    const confirmed = await showCustomConfirm("Delete the game and mods from this instance?");
    if (confirmed) {
        uninstallGameBtn.disabled = true;
        playBtn.innerText = "DELETING...";
        await window.electronAPI.uninstallGame();
        uninstallGameBtn.disabled = false;
        playBtn.innerText = "PLAY GAME";
        await syncState(); updateMainUI(); loadModsUI();
        tabMods.click(); 
    }
});

window.addEventListener('dragover', (e) => { e.preventDefault(); dropOverlay.style.display = "flex"; });
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (e.clientX <= 0 || e.clientY <= 0) dropOverlay.style.display = "none"; });
window.addEventListener('drop', async (e) => {
    e.preventDefault(); dropOverlay.style.display = "none";
    if (!getActiveInstance().bepinexInstalled) return showCustomAlert("Install BepInEx first!");
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
        const result = await window.electronAPI.installLocalMod(file);
        if (result.success) { await syncState(); loadModsUI(); }
    }
});

function renderInstances() {
    instanceOptions.innerHTML = '';
    const instances = Object.keys(appState.instances);
    
    instances.forEach(name => {
        const opt = document.createElement('div');
        opt.className = 'custom-select-option';
        opt.innerText = name;
        
        if (name === appState.activeInstance) {
            opt.classList.add('selected');
            instanceSelected.innerHTML = `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span> <i class="fa-solid fa-chevron-down"></i>`;
        }
        
        opt.addEventListener('click', async () => {
            customSelectContainer.classList.remove('open');
            if (name !== appState.activeInstance) {
                instanceSelected.style.opacity = '0.5';
                await window.electronAPI.switchInstance(name);
                await syncState();
                instanceSelected.style.opacity = '1';
                updateMainUI(); 
                loadModsUI();
                tabMods.click();
                renderInstances(); 
            }
        });
        
        instanceOptions.appendChild(opt);
    });
}

newInstanceBtn.addEventListener('click', () => { instanceNameInput.value = ''; instanceModal.style.display = 'flex'; setTimeout(() => instanceNameInput.focus(), 50); });
modalCancelBtn.addEventListener('click', () => instanceModal.style.display = 'none');
modalCreateBtn.addEventListener('click', async () => {
    const name = instanceNameInput.value.trim();
    if (name) {
        instanceModal.style.display = 'none';
        const result = await window.electronAPI.createInstance(name);
        if (result.success) { await syncState(); renderInstances(); updateMainUI(); loadModsUI(); tabMods.click(); } 
        else showCustomAlert("Failed: " + result.error);
    }
});

renameInstanceBtn.addEventListener('click', () => { renameNameInput.value = appState.activeInstance; renameModal.style.display = 'flex'; setTimeout(() => renameNameInput.focus(), 50); });
renameCancelBtn.addEventListener('click', () => renameModal.style.display = 'none');
renameSubmitBtn.addEventListener('click', async () => {
    const newName = renameNameInput.value.trim();
    if (newName && newName !== appState.activeInstance) {
        renameSubmitBtn.disabled = true;
        const result = await window.electronAPI.renameInstance(appState.activeInstance, newName);
        renameSubmitBtn.disabled = false;
        if (result.success) { renameModal.style.display = 'none'; await syncState(); renderInstances(); updateMainUI(); loadModsUI(); } 
        else showCustomAlert("Failed: " + result.error);
    } else renameModal.style.display = 'none';
});

deleteInstanceBtn.addEventListener('click', async () => {
    if (Object.keys(appState.instances).length <= 1) return showCustomAlert("Create a new instance first!");
    deleteTargetName.innerText = appState.activeInstance;
    deleteModal.style.display = 'flex';
});

deleteCancelBtn.addEventListener('click', () => deleteModal.style.display = 'none');
deleteSubmitBtn.addEventListener('click', async () => {
    deleteSubmitBtn.disabled = true;
    const result = await window.electronAPI.deleteInstance(appState.activeInstance);
    deleteSubmitBtn.disabled = false; deleteModal.style.display = 'none';
    if (result.success) { await syncState(); renderInstances(); updateMainUI(); loadModsUI(); tabMods.click(); } 
    else showCustomAlert("Failed: " + result.error);
});

function updateMainUI() {
    const inst = getActiveInstance();
    formatPlaytime(inst.playtime);

    // Update Instance Stats
    const totalMods = Object.keys(inst.installedMods || {}).length;
    const disabledMods = (inst.disabledMods || []).length;
    const activeMods = totalMods - disabledMods;

    statTotalMods.innerText = totalMods;
    statActiveMods.innerText = activeMods;
    statDisabledMods.innerText = disabledMods;

    if (inst.bepinexInstalled) {
        statBepinexStatus.innerText = "Installed";
        statBepinexStatus.style.color = "#00ff88";
    } else {
        statBepinexStatus.innerText = "Missing";
        statBepinexStatus.style.color = "#ff4d4d";
    }

    if (inst.icon) {
        customIcon.src = `file://${inst.icon}`;
        customIcon.style.display = 'block';
        defaultIcon.style.display = 'none';
    } else {
        customIcon.src = '';
        customIcon.style.display = 'none';
        defaultIcon.style.display = 'block';
    }

    bepinexBtn.innerText = "Install BepInEx";
    uninstallBepinexBtn.innerText = "Uninstall BepInEx";
    if (!inst.isDownloading) installGameBtn.innerText = "INSTALL GAME";

    if (inst.isDownloading) {
        installGameBtn.style.display = "inline-flex"; installGameBtn.innerText = inst.downloadStatus || "DOWNLOADING..."; installGameBtn.disabled = true;
        progressContainer.style.display = "block"; progressBar.style.width = `${inst.downloadPercent || 0}%`;
        playGroup.style.display = "none"; bepinexBtn.disabled = true;
    } else if (inst.gameInstalled) {
        installGameBtn.style.display = "none"; progressContainer.style.display = "none"; playGroup.style.display = "flex"; bepinexBtn.disabled = false;
    } else {
        installGameBtn.style.display = "inline-flex"; installGameBtn.disabled = false;
        progressContainer.style.display = "none"; playGroup.style.display = "none"; bepinexBtn.disabled = true;
    }

    bepinexBtn.style.display = inst.bepinexInstalled ? "none" : "inline-flex";
    uninstallBepinexBtn.style.display = inst.bepinexInstalled ? "inline-flex" : "none";
}

bepinexBtn.addEventListener('click', async () => {
    bepinexBtn.innerText = "Installing..."; bepinexBtn.disabled = true;
    const r = await window.electronAPI.installBepInEx();
    bepinexBtn.disabled = false;
    if (r.success) { await syncState(); updateMainUI(); }
    else { bepinexBtn.innerText = "Install BepInEx"; }
});

uninstallBepinexBtn.addEventListener('click', async () => {
    const confirmed = await showCustomConfirm("Are you sure you want to uninstall BepInEx?");
    if (confirmed) {
        uninstallBepinexBtn.innerText = "Uninstalling..."; uninstallBepinexBtn.disabled = true;
        const r = await window.electronAPI.uninstallBepInEx();
        uninstallBepinexBtn.disabled = false;
        if (r.success) { await syncState(); updateMainUI(); loadModsUI(); tabMods.click(); }
        else { uninstallBepinexBtn.innerText = "Uninstall BepInEx"; }
    }
});

checkUpdatesBtn.addEventListener('click', async () => {
    const originalHtml = checkUpdatesBtn.innerHTML;
    checkUpdatesBtn.disabled = true; checkUpdatesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const result = await window.electronAPI.checkForUpdates();
    if (!result.success && result.error) showCustomAlert("Update check failed: " + result.error);
    else if (!result.success) showCustomAlert("You are on the latest version.");
    checkUpdatesBtn.innerHTML = originalHtml; checkUpdatesBtn.disabled = false;
});

modSearchInput.addEventListener('input', () => loadModsUI());

async function handleInstallWithDependencies(targetModId) {
    let installQueue = [targetModId];
    const resolveDependencies = (id) => {
        const modData = githubDatabase.find(m => m.id === id);
        if (modData && modData.dependencies) {
            modData.dependencies.forEach(depId => {
                if (!getActiveInstance().installedMods[depId] && !installQueue.includes(depId)) {
                    installQueue.push(depId); resolveDependencies(depId);
                }
            });
        }
    };
    resolveDependencies(targetModId);
    if (installQueue.length > 1) {
        const confirmed = await showCustomConfirm(`Install ${installQueue.length - 1} dependencies?`);
        if (!confirmed) return;
    }
    for (let id of installQueue) {
        const data = githubDatabase.find(m => m.id === id);
        if (data) await window.electronAPI.installMod(data.id, data.download_url, data.version);
    }
    await syncState(); loadModsUI(); updateMainUI();
}

async function loadModsUI() {
    try {
        if (githubDatabase.length === 0) {
            const res = await fetch('https://raw.githubusercontent.com/Momo-Modding/Momo-Mod-Database/main/mods.json');
            const data = await res.json(); githubDatabase = data.mods;
        }
        modListContainer.innerHTML = '';
        const inst = getActiveInstance();
        const searchTerm = modSearchInput.value.toLowerCase();
        
        let displayMods = githubDatabase.filter(m => m.name.toLowerCase().includes(searchTerm) || m.description.toLowerCase().includes(searchTerm));

        displayMods.forEach(mod => {
            const installedVer = inst.installedMods[mod.id];
            const isInstalled = !!installedVer;
            const isDisabled = inst.disabledMods && inst.disabledMods.includes(mod.id);
            const needsUpdate = isInstalled && installedVer !== mod.version && installedVer !== "local";
            
            let buttonsHTML = '';
            if (isInstalled) {
                const toggleBtn = `<button class="btn-secondary toggle-mod-btn" data-id="${mod.id}" data-state="${isDisabled}">${isDisabled ? 'Enable' : 'Disable'}</button>`;
                const uninstallBtn = `<button class="btn-danger uninstall-mod-btn" data-id="${mod.id}">Uninstall</button>`;
                buttonsHTML = `<div class="mod-card-actions">${toggleBtn}${uninstallBtn}</div>`;
                if (needsUpdate) buttonsHTML = `<button class="btn-warning update-mod-btn" data-id="${mod.id}" style="margin-bottom:10px; width:100%;">Update to v${mod.version}</button>` + buttonsHTML;
            } else {
                buttonsHTML = `<div class="mod-card-actions"><button class="btn-install install-mod-btn" data-id="${mod.id}">Install Mod</button></div>`;
            }

            const modCard = document.createElement('div'); 
            modCard.className = `mod-card ${isDisabled ? 'disabled' : ''}`;
            modCard.innerHTML = `<h3>${mod.name} <small>v${mod.version}</small></h3><div class="author">By ${mod.author}</div><div class="desc">${mod.description}</div>${buttonsHTML}`;
            modListContainer.appendChild(modCard);
        });

        Object.keys(inst.installedMods).forEach(id => {
            if (inst.installedMods[id] === "local" && id.toLowerCase().includes(searchTerm)) {
                const isDisabled = inst.disabledMods && inst.disabledMods.includes(id);
                const localCard = document.createElement('div'); 
                localCard.className = `mod-card ${isDisabled ? 'disabled' : ''}`;
                localCard.innerHTML = `<h3>${id} <small>Local File</small></h3><div class="author">By You</div><div class="mod-card-actions">
                    <button class="btn-secondary toggle-mod-btn" data-id="${id}" data-state="${isDisabled}">${isDisabled ? 'Enable' : 'Disable'}</button>
                    <button class="btn-danger uninstall-mod-btn" data-id="${id}">Uninstall</button></div>`;
                modListContainer.appendChild(localCard);
            }
        });

        document.querySelectorAll('.install-mod-btn, .update-mod-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (!getActiveInstance().bepinexInstalled) return showCustomAlert("Please install BepInEx first!");
            e.target.innerText = "Working..."; e.target.disabled = true;
            handleInstallWithDependencies(e.target.getAttribute('data-id'));
        }));
        
        document.querySelectorAll('.toggle-mod-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const modId = e.target.getAttribute('data-id');
            const currentState = e.target.getAttribute('data-state') === 'true';
            e.target.innerText = "Working..."; e.target.disabled = true;
            await window.electronAPI.toggleMod(modId, !currentState);
            await syncState(); loadModsUI(); updateMainUI();
        }));

        document.querySelectorAll('.uninstall-mod-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const confirmed = await showCustomConfirm(`Uninstall this mod?`);
            if (confirmed) {
                e.target.innerText = "Deleting..."; e.target.disabled = true;
                await window.electronAPI.uninstallMod(e.target.getAttribute('data-id'));
                await syncState(); loadModsUI(); updateMainUI();
            }
        }));
    } catch (error) { modListContainer.innerHTML = `<p style="color: #ff4d4d;">Failed to load mods.</p>`; }
}

window.electronAPI.onUpdateDownloaded(() => updateModal.style.display = 'flex');
window.electronAPI.onUpdateError((e, msg) => showCustomAlert("Update error: " + msg));
updateLaterBtn.addEventListener('click', () => updateModal.style.display = 'none');
updateRestartBtn.addEventListener('click', () => window.electronAPI.restartApp());

async function bootApp() { await syncState(); renderInstances(); updateMainUI(); loadModsUI(); }
bootApp();