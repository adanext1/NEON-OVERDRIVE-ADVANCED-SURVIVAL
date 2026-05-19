const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SISTEMA DE COLECCIÓN PERMANENTE ---
let userSave = JSON.parse(localStorage.getItem('neon_overdrive_save')) || {
    materials: { core: 0, plate: 0, crystal: 0 },
    artifacts: { hyperdrive: 0, shieldGen: 0, singularity: 0, shipHp: 0, shipDmg: 0 }
};

// Migración de guardado antiguo
if (typeof userSave.artifacts.hyperdrive === 'boolean') {
    userSave.artifacts.hyperdrive = userSave.artifacts.hyperdrive ? 1 : 0;
    userSave.artifacts.shieldGen = userSave.artifacts.shieldGen ? 1 : 0;
    userSave.artifacts.singularity = userSave.artifacts.singularity ? 1 : 0;
}
if (userSave.artifacts.shipHp === undefined) userSave.artifacts.shipHp = 0;
if (userSave.artifacts.shipDmg === undefined) userSave.artifacts.shipDmg = 0;

const ARTIFACT_RECIPES = {
    hyperdrive: { name: "Motor Hiperimpulso", desc: "Reduce cooldown del Dash (5ms por nivel).", baseCost: { core: 5, plate: 2, crystal: 0 }, maxLevel: 5 },
    shieldGen: { name: "Generador de Matriz", desc: "Otorga escudo por oleada (+10 capacidad por nivel).", baseCost: { core: 3, plate: 8, crystal: 1 }, maxLevel: 5 },
    singularity: { name: "Núcleo de Singularidad", desc: "Aumenta radio del Cañón Plasma (+10% por nivel).", baseCost: { core: 10, plate: 5, crystal: 5 }, maxLevel: 5 },
    shipHp: { name: "Blindaje de Titanio", desc: "Aumenta la vida base de la nave (+15 HP por nivel).", baseCost: { core: 2, plate: 5, crystal: 0 }, maxLevel: 10 },
    shipDmg: { name: "Reactores de Plasma", desc: "Aumenta el daño global (+5% por nivel).", baseCost: { core: 5, plate: 0, crystal: 3 }, maxLevel: 10 }
};

function saveGame() { localStorage.setItem('neon_overdrive_save', JSON.stringify(userSave)); }

// --- VARIABLES DE GAMEPLAY ---
let players = [
    {
        id: 1,
        inputSource: 'keyboard',
        x: canvas.width / 2 - 40, y: canvas.height / 2, radius: 15, speed: 4.2,
        hp: 100, maxHp: 100, shield: 0, maxShield: 40, xp: 0, nextXp: 100, level: 1, credits: 0, angle: 0,
        damageModifier: 1.0, weapons: ['basic'], currentWeaponIndex: 0,
        dashCooldown: 0, dashTimer: 0, dashVx: 0, dashVy: 0, pulseCooldown: 0,
        aimMode: 'AUTO', overdriveTimer: 0, color: '#00ffcc',
        flashTicks: 0, damageFlashAlpha: 0,
        weaponUpgrades: { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } },
        upgradeCounts: { hp: 0, dmg: 0 }
    }
];

let isCoop = false;
let currentMusic = null;

const WEAPONS = {
    basic: { name: "Blaster Láser", fireRate: 230, damage: 24, speed: 13, spread: 0, count: 1, color: '#00ffcc', type: 'single' },
    shotgun: { name: "Escopeta de Dispersión", fireRate: 550, damage: 16, speed: 11, spread: 0.28, count: 5, color: '#ff007f', type: 'spread' },
    plasma: { name: "Cañón Plasma AoE", fireRate: 750, damage: 60, speed: 8, spread: 0, count: 1, color: '#ffff00', type: 'plasma', radius: 75 }
};

let keys = {}; let mouse = { x: 0, y: 0, isDown: false };
let enemies = []; let bullets = []; let particles = []; let drops = []; let hazards = []; let damageTexts = []; let airDrops = [];
let screenShake = 0; let wave = 1; let waveActive = false;
let enemiesToSpawn = 0; let spawnTimer = 0; let hazardTimer = 0;

let gameStarted = false; let isPaused = false; let inCollectionMenu = false; let isShopActive = false;
let isGameOver = false;
let selectedMenuItem = [0, 0];
let lastGamepadButtons = [];

// --- EVENTOS DINÁMICOS ---
let dynamicEvents = [];
let helperDrones = [];
let xpMultiplier = 1;
