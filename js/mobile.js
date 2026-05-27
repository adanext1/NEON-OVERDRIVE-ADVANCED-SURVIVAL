// === SOPORTE MÓVIL: CONTROLES TÁCTILES ===
// El mundo de juego usa resolución virtual fija (1920x1080), por lo que el escalado
// visual a pantalla móvil NO afecta sincronización online entre clientes.

(function () {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const forceTouch = window.location.search.includes('touch=1');
    if (!isTouchDevice && !forceTouch) return;

    const overlay = document.getElementById('touch-controls');
    if (!overlay) return;
    overlay.style.display = 'block';

    // Helper: simular tecla
    function setKey(k, val) {
        if (typeof keys !== 'undefined') keys[k] = !!val;
    }

    // ================= JOYSTICK MOVIMIENTO (izquierda) =================
    const joyMove = document.getElementById('touch-joy-move');
    const knobMove = joyMove.querySelector('.touch-joy-knob');
    let moveActiveId = null;
    let moveCenter = { x: 0, y: 0 };
    const JOY_RADIUS = () => joyMove.getBoundingClientRect().width / 2;

    function startMove(touch) {
        const r = joyMove.getBoundingClientRect();
        moveCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        updateMove(touch);
    }

    function updateMove(touch) {
        const dx = touch.clientX - moveCenter.x;
        const dy = touch.clientY - moveCenter.y;
        const max = JOY_RADIUS();
        const dist = Math.min(Math.hypot(dx, dy), max);
        const ang = Math.atan2(dy, dx);
        const kx = Math.cos(ang) * dist;
        const ky = Math.sin(ang) * dist;
        knobMove.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        // Convertir a teclas wasd. Umbral 25% del radio para activar.
        const dz = max * 0.25;
        setKey('w', dy < -dz);
        setKey('s', dy > dz);
        setKey('a', dx < -dz);
        setKey('d', dx > dz);
    }

    function endMove() {
        knobMove.style.transform = `translate(-50%, -50%)`;
        setKey('w', false); setKey('a', false); setKey('s', false); setKey('d', false);
    }

    // ================= JOYSTICK APUNTADO (derecha) =================
    const joyAim = document.getElementById('touch-joy-aim');
    const knobAim = joyAim.querySelector('.touch-joy-knob');
    let aimActiveId = null;
    let aimCenter = { x: 0, y: 0 };

    function startAim(touch) {
        const r = joyAim.getBoundingClientRect();
        aimCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        // Forzar modo manual para que el ángulo respete el joystick
        if (typeof getLocalPlayer === 'function') {
            let lp = getLocalPlayer();
            if (lp) lp.aimMode = 'MANUAL';
        }
        // Al tocar la palanca derecha para apuntar, también activar el auto-disparo
        if (typeof mouse !== 'undefined') {
            mouse.isDown = true;
        }
        updateAim(touch);
    }

    function updateAim(touch) {
        const dx = touch.clientX - aimCenter.x;
        const dy = touch.clientY - aimCenter.y;
        const max = joyAim.getBoundingClientRect().width / 2;
        const dist = Math.min(Math.hypot(dx, dy), max);
        const ang = Math.atan2(dy, dx);
        const kx = Math.cos(ang) * dist;
        const ky = Math.sin(ang) * dist;
        knobAim.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        // Solo aplicar si hay desplazamiento mínimo
        if (dist < max * 0.15) return;

        // Calcular target en coordenadas virtuales del canvas
        if (typeof getLocalPlayer === 'function' && typeof canvas !== 'undefined') {
            let lp = getLocalPlayer();
            if (!lp) return;
            // Mover el "mouse" virtual hacia adelante en la dirección del joystick
            const reach = 400; // píxeles virtuales
            mouse.x = lp.x + Math.cos(ang) * reach;
            mouse.y = lp.y + Math.sin(ang) * reach;
        }
    }

    function endAim() {
        knobAim.style.transform = `translate(-50%, -50%)`;
        // Dejar de disparar si se suelta el joystick de apuntado,
        // a menos que se mantenga pulsado el botón de disparar dedicado.
        if (typeof mouse !== 'undefined') {
            const fireBtnActive = document.querySelector('.touch-btn-fire:active');
            if (!fireBtnActive) {
                mouse.isDown = false;
            }
        }
    }

    // ================= REGISTRAR TOUCHES MÚLTIPLES =================
    function handleTouchStart(e) {
        for (let t of e.changedTouches) {
            const target = document.elementFromPoint(t.clientX, t.clientY);
            if (!target) continue;
            const inMove = joyMove.contains(target) || target === joyMove;
            const inAim = joyAim.contains(target) || target === joyAim;
            if (inMove && moveActiveId === null) {
                moveActiveId = t.identifier;
                startMove(t);
                e.preventDefault();
            } else if (inAim && aimActiveId === null) {
                aimActiveId = t.identifier;
                startAim(t);
                e.preventDefault();
            }
        }
    }

    function handleTouchMove(e) {
        for (let t of e.changedTouches) {
            if (t.identifier === moveActiveId) { updateMove(t); e.preventDefault(); }
            else if (t.identifier === aimActiveId) { updateAim(t); e.preventDefault(); }
        }
    }

    function handleTouchEnd(e) {
        for (let t of e.changedTouches) {
            if (t.identifier === moveActiveId) { moveActiveId = null; endMove(); }
            else if (t.identifier === aimActiveId) { aimActiveId = null; endAim(); }
        }
    }

    // Listeners en document para no perder eventos al salir del joystick
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // ================= BOTONES DE ACCIÓN =================
    function setupActionButton(selector, opts) {
        const btn = document.querySelector(selector);
        if (!btn) return;
        const onDown = (e) => {
            e.preventDefault();
            if (opts.onDown) opts.onDown();
        };
        const onUp = (e) => {
            e.preventDefault();
            if (opts.onUp) opts.onUp();
        };
        btn.addEventListener('touchstart', onDown, { passive: false });
        btn.addEventListener('touchend', onUp, { passive: false });
        btn.addEventListener('touchcancel', onUp, { passive: false });
        // También con clicks de mouse para test en escritorio con ?touch=1
        btn.addEventListener('mousedown', onDown);
        btn.addEventListener('mouseup', onUp);
        btn.addEventListener('mouseleave', onUp);
    }

    // Disparar: mantener mouse.isDown
    setupActionButton('.touch-btn-fire', {
        onDown: () => { if (typeof mouse !== 'undefined') mouse.isDown = true; },
        onUp:   () => { if (typeof mouse !== 'undefined') mouse.isDown = false; }
    });

    // Arma especial (clic derecho equivalente)
    setupActionButton('.touch-btn-special', {
        onDown: () => {
            if (typeof getLocalPlayer !== 'function') return;
            let p = getLocalPlayer();
            if (!p) return;
            if ((p.empTimer || 0) > 0 || (p.laserCooldown || 0) > 0 || p.isTurret) return;
            let pSave = (typeof getPlayerSave === 'function') ? getPlayerSave(p) : (typeof userSave !== 'undefined' ? userSave : null);
            let specWep = (pSave && pSave.nexusBuild && pSave.nexusBuild.specialWeapon) || 'laser';
            if (specWep === 'laser') {
                p.isChargingLaser = true;
                p.laserCharge = 0;
            } else if (specWep === 'mortar' && typeof fireMortar === 'function') {
                fireMortar(p);
            }
        },
        onUp: () => {
            if (typeof getLocalPlayer !== 'function') return;
            let p = getLocalPlayer();
            if (p && p.isChargingLaser && typeof fireMegaLaser === 'function') {
                p.isChargingLaser = false;
                fireMegaLaser(p);
            }
        }
    });

    // Habilidades: una sola pulsación
    setupActionButton('.touch-btn-shift', {
        onDown: () => { if (typeof triggerAbility === 'function') triggerAbility('Shift'); }
    });
    setupActionButton('.touch-btn-e', {
        onDown: () => { if (typeof triggerAbility === 'function') triggerAbility('E'); }
    });
    setupActionButton('.touch-btn-q', {
        onDown: () => { if (typeof triggerAbility === 'function') triggerAbility('Q'); }
    });
    setupActionButton('.touch-btn-space', {
        onDown: () => {
            if (typeof gameStarted !== 'undefined' && gameStarted && !isPaused) {
                if (typeof waveActive !== 'undefined' && waveActive) {
                    if (typeof triggerAbility === 'function') triggerAbility('Space');
                } else if (typeof enemies !== 'undefined' && enemies.length === 0 && !inCollectionMenu && typeof toggleShop === 'function') {
                    toggleShop(!isShopActive);
                }
            }
        }
    });

    // Toggle apuntado AUTO/MANUAL
    setupActionButton('.touch-btn-aim', {
        onDown: () => {
            if (typeof getLocalPlayer !== 'function') return;
            let p = getLocalPlayer();
            if (!p) return;
            p.aimMode = p.aimMode === 'AUTO' ? 'MANUAL' : 'AUTO';
            if (typeof updateUI === 'function') updateUI();
        }
    });

    // Pausa
    setupActionButton('.touch-btn-pause', {
        onDown: () => {
            if (typeof gameStarted !== 'undefined' && gameStarted && typeof togglePause === 'function') {
                if (!isShopActive && !inCollectionMenu) togglePause();
            }
        }
    });

    // Pantalla completa (Fullscreen API)
    const fsBtn = document.getElementById('touch-btn-fs');
    if (fsBtn) {
        fsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error al activar pantalla completa: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
        // Soporte táctil directo
        fsBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {});
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Mostrar overlay solo durante juego activo (ocultar en menús/modales/pausa)
    function isModalOpen() {
        const ids = ['shop-modal', 'level-up-modal', 'pause-modal', 'game-over-modal',
                     'controls-modal', 'collection-modal', 'main-menu', 'settings-modal'];
        return ids.some(id => {
            const el = document.getElementById(id);
            return el && el.style.display && el.style.display !== 'none';
        });
    }
    function refreshTouchVisibility() {
        const showing = (typeof gameStarted !== 'undefined') && gameStarted && !isModalOpen();
        overlay.style.display = showing ? 'block' : 'none';
    }
    setInterval(refreshTouchVisibility, 300);

    // Evitar que se haga zoom con doble-tap
    document.addEventListener('gesturestart', e => e.preventDefault());
})();
