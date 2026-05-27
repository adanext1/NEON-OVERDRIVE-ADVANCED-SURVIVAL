const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SISTEMA DE RESOLUCIÓN VIRTUAL ---
const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;

function resizeCanvas() {
    // Asignar resolución lógica interna del canvas
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;

    // Asignar tamaño visual al 100% de la ventana (estiramiento completo)
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.marginTop = '0px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SISTEMA DE COLECCIÓN PERMANENTE ---
let userSave = JSON.parse(localStorage.getItem('neon_overdrive_save')) || {
    materials: { core: 0, plate: 0, crystal: 0, bossRelic: 0 },
    artifacts: { hyperdrive: 0, shieldGen: 0, singularity: 0, shipHp: 0, shipDmg: 0 },
    settings: { musicVolume: 0.7, sfxVolume: 0.7 },
    unlockedArtifacts: []
};

// --- CATÁLOGO TÉCNICO DE COMPONENTES ---
const COMPONENT_CATALOG = {
    // --- MÓDULOS PASIVOS ---
    //⚪ TIER: COMÚN
    passive_hp: { id: 'passive_hp', name: "Refuerzo de Chasis", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "+15 HP por nivel.", ultraDesc: "Blindaje Reactivo: Al recibir daño, emite una chispa que daña enemigos cercanos (20 dmg)." },
    passive_dmg: { id: 'passive_dmg', name: "Calibración de Mirilla", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "+5% Daño de arma principal por nivel.", ultraDesc: "Foco Infinito: El primer disparo después de 2s sin disparar hace 200% de daño." },
    passive_cooldown: { id: 'passive_cooldown', name: "Batería de Repuesto", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "-4% Cooldown global por nivel.", ultraDesc: "Reciclaje: Matar a un enemigo reduce 0.5s el cooldown activo actual." },
    passive_shield: { id: 'passive_shield', name: "Célula de Escudo", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "+10 Escudo máximo por nivel.", ultraDesc: "Reinicio Forzado: Si el escudo llega a 0, se regenera instantáneamente al 50% (CD: 60s)." },
    passive_magnet: { id: 'passive_magnet', name: "Imán de Chatarra", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "+10% Radio de recogida por nivel.", ultraDesc: "Aspiradora de Datos: Al activar cualquier habilidad Q, E o Space, atrae todo el botín del mapa." },
    passive_speed: { id: 'passive_speed', name: "Motor Optimizado", type: 'passive', tier: 'common', ram: 5, baseCost: 500, desc: "+3% Velocidad de movimiento por nivel.", ultraDesc: "Post-combustión: Hacer un Dash otorga +20% velocidad por 2s." },

    //🔵 TIER: RARO
    passive_burn: { id: 'passive_burn', name: "Munición Incendiaria", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "Disparos tienen 5% acumulación de quemadura por nivel.", ultraDesc: "Ignición en Cadena: Enemigos que mueren quemados explotan en fuego." },
    passive_energy_def: { id: 'passive_energy_def', name: "Placas Refractarias", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "Reduce daño de láseres y proyectiles de energía en 6% por nivel.", ultraDesc: "Prisma: Refleja el 15% del daño de energía recibido al atacante." },
    passive_regen: { id: 'passive_regen', name: "Reparación Automática", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "Cura 1 HP cada 4s (mejora -0.5s por nivel).", ultraDesc: "Nanobots Médicos: Al estar cerca de un aliado, compartes el 50% de tu regeneración." },
    passive_proj_speed: { id: 'passive_proj_speed', name: "Acelerador de Partículas", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "+6% Velocidad de proyectil por nivel.", ultraDesc: "Impacto Cinético: Proyectiles rápidos tienen 20% de probabilidad de aturdir (Stun) 0.5s." },
    passive_knockback: { id: 'passive_knockback', name: "Condensador de Pulso", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "+10% Fuerza de empuje (Knockback) por nivel.", ultraDesc: "Onda de Choque: Los enemigos empujados contra paredes reciben daño doble." },
    passive_heat_def: { id: 'passive_heat_def', name: "Enfriador Criogénico", type: 'passive', tier: 'rare', ram: 10, baseCost: 1200, req: "Lvl 5 de 1 Pasiva Común", desc: "Armas tardan 8% más en sobrecalentarse por nivel.", ultraDesc: "Cero Absoluto: Al sobrecalentarse, congelas a los enemigos en un radio corto por 2s." },

    //🟣 TIER: ÉPICO
    passive_crit_dmg: { id: 'passive_crit_dmg', name: "Analizador de Debilidades", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "+5% Daño Crítico por nivel.", ultraDesc: "Punto de Quiebre: Los críticos tienen 10% probabilidad de ejecutar enemigos <15% HP." },
    passive_status_res: { id: 'passive_status_res', name: "Módulo de Resistencia", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "+8% Resistencia a estados (Stun, Slow) por nivel.", ultraDesc: "Inquebrantable: Al recibir un Stun, ganas invulnerabilidad por 1.5s (CD: 30s)." },
    passive_ally_dmg: { id: 'passive_ally_dmg', name: "Transmisor de Energía", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "Al recoger Cristal, aliados ganan +5% daño por nivel (10s).", ultraDesc: "Inyección de Red: El efecto ahora reduce los cooldowns de los aliados en 2s." },
    passive_skill_dmg: { id: 'passive_skill_dmg', name: "Célula de Sobrecarga", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "+7% Daño de habilidades activas por nivel.", ultraDesc: "Eco de Poder: Al usar una habilidad, hay 20% probabilidad de que no entre en CD." },
    passive_evade: { id: 'passive_evade', name: "Escudo Espectral", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "+4% Probabilidad de evadir un disparo por nivel.", ultraDesc: "Desfase: Al evadir, te vuelves invisible por 1s." },
    passive_adrenal: { id: 'passive_adrenal', name: "Inyector de Adrenalina", type: 'passive', tier: 'epic', ram: 15, baseCost: 3500, req: "Derrotar a Vector Supreme", desc: "Matar a Élite otorga +10% de cadencia de fuego por nivel (5s).", ultraDesc: "Estado de Flujo: Mientras el bono esté activo, tu nave no consume energía/calor." },

    //🟡 TIER: LEGENDARIO
    passive_singularity: { id: 'passive_singularity', name: "Núcleo de Singularidad", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Cada 10 disparos, el siguiente crea mini-succión que atrae enemigos.", ultraDesc: "Colapso Final: La succión termina en una explosión de 300 dmg." },
    passive_guardian: { id: 'passive_guardian', name: "Protocolo Guardián", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Si un aliado recibe daño letal, tú lo recibes (mitigación +10% por nivel).", ultraDesc: "Mártir: Al morir, explotas curando al 100% a todos tus aliados." },
    passive_kit_opt: { id: 'passive_kit_opt', name: "Optimización de Kit", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Puedes llevar 1 ranura extra de habilidad activa (RAM extra requerida).", ultraDesc: "Maestro de Armas: Todas las habilidades activas ganan +1 nivel de escalado base." },
    passive_bounce: { id: 'passive_bounce', name: "Balística de Rebote", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Las balas tienen 10% probabilidad de rebotar por nivel.", ultraDesc: "Fragmentación: Al rebotar, la bala se divide en dos proyectiles pequeños." },
    passive_stasis: { id: 'passive_stasis', name: "Matriz de Estasis", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Al recibir daño de jefe, el jefe se ralentiza un 5% por nivel (3s).", ultraDesc: "Prisión de Tiempo: Bloquear ataque de jefe tiene 5% de congelar su patrón por 2s." },
    passive_lifesteal: { id: 'passive_lifesteal', name: "Sifón de Vida", type: 'passive', tier: 'legendary', ram: 25, baseCost: 8000, req: "Derrotar a Overlord Apex", desc: "Recuperas 0.5% de HP por cada 100 de daño infligido por nivel.", ultraDesc: "Drenaje Colectivo: Tu daño cura al aliado con menos HP en la sala." },

    //🔥 TIER: MÍTICO
    passive_omnipotence: { id: 'passive_omnipotence', name: "Omnipotencia de Datos", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "Tu daño aumenta 1% por cada 1,000 Créditos guardados.", ultraDesc: "Capitalismo Salvaje: Disparar gasta 1 Crédito, pero el daño se multiplica por 5." },
    passive_blackhole: { id: 'passive_blackhole', name: "Cuerpo de Agujero Negro", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "Proyectiles enemigos cercanos son desviados hacia ti (los absorbes como escudo).", ultraDesc: "Horizonte de Sucesos: Al llegar al máximo de escudo, emites pulso que desintegra pantalla." },
    passive_quantum_rez: { id: 'passive_quantum_rez', name: "Resurrección Cuántica", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "Al morir un aliado, puedes revivirlo instantáneamente (CD: 180s, -20s por nivel).", ultraDesc: "Paradoja: Al revivir a alguien, ambos ganan invulnerabilidad y daño x2 por 5s." },
    passive_code_vengeance: { id: 'passive_code_vengeance', name: "Venganza de Código", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "Por cada 1% de HP que te falte, haces +2% de daño.", ultraDesc: "Cero Absoluto: Si te queda 1 HP, tu daño es crítico garantizado y atraviesa paredes." },
    passive_hivemind: { id: 'passive_hivemind', name: "Mente de Colmena", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "Compartes tus pasivas con aliados a un 20% de efectividad por nivel.", ultraDesc: "Unidad Total: Si los 4 jugadores tienen este módulo, la efectividad es del 100%." },
    passive_anomaly: { id: 'passive_anomaly', name: "La Anomalía", type: 'passive', tier: 'mythic', ram: 40, baseCost: 20000, req: "Dificultad 22+", desc: "El daño de tus armas cambia de tipo aleatoriamente cada 5s.", ultraDesc: "Inestabilidad Pura: Tus disparos aplican todos los efectos de estado al mismo tiempo." },

    // --- ARMAS PRIMARIAS ---
    basic: { id: 'basic', name: "Bláster Láser", type: 'primary_weapon', tier: 'common', ram: 5, baseCost: 0, desc: "Disparo láser básico y preciso." },
    shotgun: { id: 'shotgun', name: "Escopeta de Dispersión", type: 'primary_weapon', tier: 'rare', ram: 15, baseCost: 1000, desc: "Disparo de ráfaga dispersa a corta distancia." },
    plasma: { id: 'plasma', name: "Cañón Plasma AoE", type: 'primary_weapon', tier: 'epic', ram: 25, baseCost: 2500, desc: "Lanza proyectiles lentos con gran radio de explosión." },

    // --- ARMAS ESPECIALES ---
    laser: { id: 'laser', name: "Mega-Láser", type: 'special_weapon', tier: 'rare', ram: 20, baseCost: 0, desc: "Láser cargado devastador. Se activa con Clic Derecho." },
    mortar: { id: 'mortar', name: "Lanzador de Mortero", type: 'special_weapon', tier: 'epic', ram: 15, baseCost: 1500, desc: "Dispara mortero parabólico de alto daño a la posición de cursor. Clic Derecho." },

    // --- HABILIDADES ---
    // 🔴 TIER: COMÚN
    turbo_impulso: { id: 'turbo_impulso', name: "Turbo-Impulso", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Un Dash corto con 2 cargas.", ultraDesc: "El Dash te vuelve invisible por 0.5s." },
    pulso_choque: { id: 'pulso_choque', name: "Pulso de Choque", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Empuja enemigos cercanos.", ultraDesc: "El empuje aturde (Stun) por 1.5s." },
    blaster_repeticion: { id: 'blaster_repeticion', name: "Bláster de Repetición", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Disparo estándar rápido.", ultraDesc: "Dispara 2 balas extra en diagonal." },
    mina_proximidad: { id: 'mina_proximidad', name: "Mina de Proximidad", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Deja una mina que explota al contacto.", ultraDesc: "La mina se divide en 3 mini-bombas al explotar." },
    reparacion_emergencia: { id: 'reparacion_emergencia', name: "Reparación de Emergencia", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Cura 15% de HP. Cooldown largo.", ultraDesc: "Limpia todos los efectos negativos (Quemadura, Lentitud)." },
    escudo_frontal: { id: 'escudo_frontal', name: "Escudo Frontal", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Pequeña barrera que bloquea 3 proyectiles.", ultraDesc: "Al romperse, devuelve el daño en un área pequeña." },
    bengala_distraccion: { id: 'bengala_distraccion', name: "Bengala de Distracción", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Los enemigos disparan hacia la bengala.", ultraDesc: "La bengala explota al expirar, cegando a los enemigos." },
    dron_escolta: { id: 'dron_escolta', name: "Dron de Escolta", type: 'skill', tier: 'common', ram: 8, baseCost: 600, desc: "Un dron que dispara balas débiles automáticamente.", ultraDesc: "El dron ahora intercepta proyectiles enemigos." },

    // 🔵 TIER: RARO
    mega_laser_carga: { id: 'mega_laser_carga', name: "Mega-Láser de Carga", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Rayo potente que perfora enemigos.", ultraDesc: "El rayo deja una estela de daño por 2s." },
    mortero_plasma: { id: 'mortero_plasma', name: "Mortero de Plasma", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Disparo parabólico que deja fuego en el suelo.", ultraDesc: "El fuego ahora ralentiza a los enemigos." },
    cupula_defensiva: { id: 'cupula_defensiva', name: "Cúpula Defensiva", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Área circular que protege a aliados dentro.", ultraDesc: "Los aliados dentro disparan un 15% más rápido." },
    rayo_enlace: { id: 'rayo_enlace', name: "Rayo de Enlace", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Te une a un aliado y regeneras su escudo.", ultraDesc: "El aliado enlazado gana un 20% de daño extra." },
    gancho_energia: { id: 'gancho_energia', name: "Gancho de Energía", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Jala a un enemigo hacia ti.", ultraDesc: "Al llegar a ti, el enemigo recibe un golpe crítico automático." },
    granada_criogenia: { id: 'granada_criogenia', name: "Granada de Criogenia", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Congela enemigos en un área.", ultraDesc: "Los enemigos congelados reciben 30% más de daño." },
    sobrecarga_armas: { id: 'sobrecarga_armas', name: "Sobrecarga de Armas", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Dobla tu cadencia de fuego, pero consume HP.", ultraDesc: "Matar a un enemigo mientras está activo te cura." },
    salto_falla: { id: 'salto_falla', name: "Salto de Falla (Blink)", type: 'skill', tier: 'rare', ram: 12, baseCost: 1500, desc: "Teletransporte instantáneo corto.", ultraDesc: "Deja un clon explosivo en tu posición anterior." },

    // 🟣 TIER: ÉPICO
    agujero_negro: { id: 'agujero_negro', name: "Agujero Negro (Singularidad)", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Succiona enemigos al centro.", ultraDesc: "Al colapsar, lanza los enemigos hacia afuera con daño de choque." },
    lluvia_misiles: { id: 'lluvia_misiles', name: "Lluvia de Misiles", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Fija 5 objetivos y lanza misiles teledirigidos.", ultraDesc: "Cada misil genera una pequeña explosión AoE." },
    escudo_espejo: { id: 'escudo_espejo', name: "Escudo de Espejo", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Devuelve los proyectiles enemigos hacia ellos.", ultraDesc: "Las balas devueltas son siempre críticas." },
    torreta_desplegable: { id: 'torreta_desplegable', name: "Torreta Desplegable", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Estacionaria, gran daño.", ultraDesc: "La torreta ahora dispara misiles cada 3s." },
    inyeccion_nanobots: { id: 'inyeccion_nanobots', name: "Inyección de Nanobots", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Cura a todos los aliados en un radio grande.", ultraDesc: "Otorga inmunidad al daño por 1s al activarse." },
    pulso_magnetico: { id: 'pulso_magnetico', name: "Pulso Magnético (EMP)", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Desactiva las habilidades de los enemigos (y jefes).", ultraDesc: "Reduce la armadura de los afectados a cero." },
    campo_estasis: { id: 'campo_estasis', name: "Campo de Éstasis", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Detiene los proyectiles enemigos en el aire.", ultraDesc: "Al terminar, los proyectiles caen al suelo como botín (Créditos)." },
    teletransporte_grupo: { id: 'teletransporte_grupo', name: "Teletransporte de Grupo", type: 'skill', tier: 'epic', ram: 20, baseCost: 4000, desc: "Mueve a todo tu equipo a una ubicación.", ultraDesc: "Otorga un escudo de 50 pts a todos tras el salto." },

    // 🟡 TIER: LEGENDARIO
    rayo_orbital: { id: 'rayo_orbital', name: "Rayo Orbital", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Un láser gigante del cielo sigue tu puntero.", ultraDesc: "El rayo se divide en 3 rayos más pequeños pero rápidos." },
    protocolo_ultima_muralla: { id: 'protocolo_ultima_muralla', name: "Protocolo \"Última Muralla\"", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Te vuelve inmune al daño pero no puedes moverte.", ultraDesc: "Mientras eres inmune, atraes todas las balas de la pantalla." },
    frenesi_cinetico: { id: 'frenesi_cinetico', name: "Frenesí Cinético", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Tus ataques cuerpo a cuerpo (embestidas) hacen x10 daño.", ultraDesc: "Cada muerte con embestida resetea el cooldown del Dash." },
    dron_resurreccion: { id: 'dron_resurreccion', name: "Dron de Resurrección", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Revive automáticamente a un aliado caído.", ultraDesc: "El aliado revive con 100% HP y escudos." },
    tormenta_electrica: { id: 'tormenta_electrica', name: "Tormenta Eléctrica", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Rayos aleatorios golpean a los enemigos.", ultraDesc: "Los rayos saltan entre enemigos cercanos (Chain Lightning)." },
    canon_antimateria: { id: 'canon_antimateria', name: "Cañón de Antimateria", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Disparo lento que borra todo a su paso.", ultraDesc: "Deja un camino de vacío que destruye balas enemigas." },
    invisibilidad_total: { id: 'invisibilidad_total', name: "Invisibilidad Total", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Desapareces del radar enemigo por 5s.", ultraDesc: "Tu primer disparo al salir de invisibilidad hace x5 daño." },
    enlace_vida: { id: 'enlace_vida', name: "Enlace de Vida", type: 'skill', tier: 'legendary', ram: 30, baseCost: 10000, desc: "Todo el daño recibido por el equipo se divide equitativamente.", ultraDesc: "Reduce el daño total recibido por el equipo en un 30%." },

    // 🔥 TIER: MÍTICO
    colapso_codigo: { id: 'colapso_codigo', name: "Colapso de Código", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Borra a todos los enemigos menores de la pantalla.", ultraDesc: "Reduce la vida de los jefes en un 10% fijo." },
    avatar_guerra: { id: 'avatar_guerra', name: "Avatar de la Guerra", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Te transformas en una nave gigante por 10s.", ultraDesc: "Eres inmune a todo y disparas ráfagas de 360 grados." },
    cronos: { id: 'cronos', name: "Cronos (Control del Tiempo)", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Ralentiza todo el juego excepto a ti y tus aliados.", ultraDesc: "Las balas de tus aliados se quedan suspendidas y viajan al doble de velocidad al terminar el efecto." },
    supernova: { id: 'supernova', name: "Supernova", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Explotas dañando a todos (incluyéndote).", ultraDesc: "Si sobrevives, tus estadísticas se doblan por el resto de la oleada." },
    llamada_flota: { id: 'llamada_flota', name: "Llamada de la Flota", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Invocas 10 naves aliadas controladas por la IA.", ultraDesc: "Las naves aliadas imitan tus habilidades activas." },
    rayo_creacion: { id: 'rayo_creacion', name: "Rayo de la Creación", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Cura aliados y daña enemigos simultáneamente.", ultraDesc: "Si un aliado está al 100% HP, el rayo le da un escudo infinito temporal." },
    juicio_final: { id: 'juicio_final', name: "Juicio Final", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Dispara un proyectil que explota según cuántos enemigos hayas matado.", ultraDesc: "Si has matado a más de 100, el daño es infinito." },
    singularidad_maestra: { id: 'singularidad_maestra', name: "La Singularidad Maestra", type: 'skill', tier: 'mythic', ram: 45, baseCost: 25000, desc: "Crea un agujero negro que se traga hasta los proyectiles de los Jefes.", ultraDesc: "Al final, el agujero negro \"escupe\" los proyectiles de los jefes como si fueran tuyos." }
};

// Migración y adaptación del guardado antiguo
if (typeof userSave.artifacts.hyperdrive === 'boolean') {
    userSave.artifacts.hyperdrive = userSave.artifacts.hyperdrive ? 1 : 0;
    userSave.artifacts.shieldGen = userSave.artifacts.shieldGen ? 1 : 0;
    userSave.artifacts.singularity = userSave.artifacts.singularity ? 1 : 0;
}
if (userSave.artifacts.shipHp === undefined) userSave.artifacts.shipHp = 0;
if (userSave.artifacts.shipDmg === undefined) userSave.artifacts.shipDmg = 0;
if (userSave.settings === undefined) userSave.settings = { musicVolume: 0.7, sfxVolume: 0.7 };
if (userSave.unlockedArtifacts === undefined) userSave.unlockedArtifacts = [];

// Nuevos campos de Nexus de Ensamblaje
if (!userSave.materials) userSave.materials = { core: 0, plate: 0, crystal: 0, bossRelic: 0 };
if (userSave.materials.bossRelic === undefined) userSave.materials.bossRelic = 0;

if (!userSave.componentLevels) userSave.componentLevels = {};
if (!userSave.unlockedComponents) {
    userSave.unlockedComponents = ['basic', 'laser', 'turbo_impulso', 'pulso_choque', 'sobrecarga_armas', 'torreta_desplegable'];
}

// Convertir artefactos antiguos a componentes nuevos
if (userSave.artifacts) {
    if (userSave.artifacts.shipHp > 0 && !userSave.componentLevels.passive_hp) {
        userSave.componentLevels.passive_hp = userSave.artifacts.shipHp;
        if (!userSave.unlockedComponents.includes('passive_hp')) userSave.unlockedComponents.push('passive_hp');
    }
    if (userSave.artifacts.shipDmg > 0 && !userSave.componentLevels.passive_dmg) {
        userSave.componentLevels.passive_dmg = userSave.artifacts.shipDmg;
        if (!userSave.unlockedComponents.includes('passive_dmg')) userSave.unlockedComponents.push('passive_dmg');
    }
    if (userSave.artifacts.shieldGen > 0 && !userSave.componentLevels.passive_shield) {
        userSave.componentLevels.passive_shield = userSave.artifacts.shieldGen;
        if (!userSave.unlockedComponents.includes('passive_shield')) userSave.unlockedComponents.push('passive_shield');
    }
    if (userSave.artifacts.hyperdrive > 0 && !userSave.componentLevels.passive_speed) {
        userSave.componentLevels.passive_speed = userSave.artifacts.hyperdrive;
        if (!userSave.unlockedComponents.includes('passive_speed')) userSave.unlockedComponents.push('passive_speed');
    }
    if (userSave.artifacts.singularity > 0 && !userSave.componentLevels.passive_singularity) {
        userSave.componentLevels.passive_singularity = userSave.artifacts.singularity;
        if (!userSave.unlockedComponents.includes('passive_singularity')) userSave.unlockedComponents.push('passive_singularity');
    }
}

// MIGRACIÓN DE IDS DE HABILIDADES ANTIGUAS
const OLD_TO_NEW_SKILLS = {
    'dash': 'turbo_impulso',
    'pulse': 'pulso_choque',
    'overload': 'sobrecarga_armas',
    'turret': 'torreta_desplegable',
    'teleport': 'salto_falla'
};

if (userSave.unlockedComponents) {
    userSave.unlockedComponents = userSave.unlockedComponents.map(id => OLD_TO_NEW_SKILLS[id] || id);
}

if (userSave.componentLevels) {
    for (let oldId in OLD_TO_NEW_SKILLS) {
        let newId = OLD_TO_NEW_SKILLS[oldId];
        if (userSave.componentLevels[oldId] !== undefined) {
            if (userSave.componentLevels[newId] === undefined) {
                userSave.componentLevels[newId] = userSave.componentLevels[oldId];
            }
            delete userSave.componentLevels[oldId];
        }
    }
}

// Configurar build por defecto en Nexus
if (!userSave.nexusBuild) {
    userSave.nexusBuild = {
        passives: [null, null, null],
        skills: {
            Q: 'sobrecarga_armas',
            E: 'pulso_choque',
            Shift: 'turbo_impulso',
            Space: 'torreta_desplegable'
        },
        primaryWeapon: 'basic',
        specialWeapon: 'laser'
    };
    
    // Equipar automáticamente pasivos migrados
    let migratedPassives = ['passive_hp', 'passive_dmg', 'passive_shield', 'passive_speed', 'passive_singularity'];
    let equipIdx = 0;
    migratedPassives.forEach(pId => {
        if (userSave.componentLevels[pId] > 0 && equipIdx < 3) {
            userSave.nexusBuild.passives[equipIdx] = pId;
            equipIdx++;
        }
    });
} else if (userSave.nexusBuild.skills) {
    // Migrar habilidades equipadas en el nexusBuild
    for (let slot in userSave.nexusBuild.skills) {
        let skillId = userSave.nexusBuild.skills[slot];
        if (OLD_TO_NEW_SKILLS[skillId]) {
            userSave.nexusBuild.skills[slot] = OLD_TO_NEW_SKILLS[skillId];
        }
    }
}

// Asegurarse de que las piezas básicas estén desbloqueadas
['basic', 'laser', 'turbo_impulso', 'pulso_choque', 'sobrecarga_armas', 'torreta_desplegable'].forEach(id => {
    if (!userSave.unlockedComponents.includes(id)) userSave.unlockedComponents.push(id);
});

// Asegurar nivel mínimo 1 para componentes desbloqueados (pasivos y habilidades)
userSave.unlockedComponents.forEach(id => {
    let comp = COMPONENT_CATALOG[id];
    if (comp && (comp.type === 'passive' || comp.type === 'skill')) {
        if (userSave.componentLevels[id] === undefined || userSave.componentLevels[id] === 0) {
            userSave.componentLevels[id] = 1;
        }
    }
});

// Guardado del juego para asegurar la migración
localStorage.setItem('neon_overdrive_save', JSON.stringify(userSave));

// --- FUNCIONES HELPER PARA EL NEXUS ---
function getEquippedRam() {
    let ram = 0;
    let build = userSave.nexusBuild;
    if (!build) return 0;
    if (build.primaryWeapon && COMPONENT_CATALOG[build.primaryWeapon]) {
        ram += COMPONENT_CATALOG[build.primaryWeapon].ram;
    }
    if (build.specialWeapon && COMPONENT_CATALOG[build.specialWeapon]) {
        ram += COMPONENT_CATALOG[build.specialWeapon].ram;
    }
    for (let key in build.skills) {
        let skillId = build.skills[key];
        if (skillId && COMPONENT_CATALOG[skillId]) {
            ram += COMPONENT_CATALOG[skillId].ram;
        }
    }
    if (build.passives) {
        build.passives.forEach(pId => {
            if (pId && COMPONENT_CATALOG[pId]) {
                ram += COMPONENT_CATALOG[pId].ram;
            }
        });
    }
    return ram;
}

function getPassiveLevel(id) {
    if (!userSave.nexusBuild || !userSave.nexusBuild.passives) return 0;
    if (!userSave.nexusBuild.passives.includes(id)) return 0;
    return userSave.componentLevels[id] || 0;
}

function getActiveSkillLevel(id) {
    if (!userSave.nexusBuild || !userSave.nexusBuild.skills) return 0;
    if (!Object.values(userSave.nexusBuild.skills).includes(id)) return 0;
    return userSave.componentLevels[id] || 0;
}

function getActiveSkillModifier(id) {
    let lvl = getActiveSkillLevel(id);
    if (lvl === 0) {
        lvl = userSave.componentLevels[id] || 1;
    }
    let cdMultiplier = 1.0;
    let effectMultiplier = 1.0;
    
    if (lvl === 2) {
        cdMultiplier = 0.9;
        effectMultiplier = 1.2;
    } else if (lvl === 3) {
        cdMultiplier = 0.8;
        effectMultiplier = 1.4;
    } else if (lvl === 4) {
        cdMultiplier = 0.7;
        effectMultiplier = 1.6;
    } else if (lvl === 5) {
        cdMultiplier = 0.5;
        effectMultiplier = 2.0;
    } else if (lvl === 6) {
        cdMultiplier = 0.4;
        effectMultiplier = 2.0;
    }
    return { cdMultiplier, effectMultiplier, level: lvl };
}

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
        flashTicks: 0, damageFlashAlpha: 0, invulnTimer: 0,
        weaponUpgrades: { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } },
        upgradeCounts: { hp: 0, dmg: 0, laser: 0, minigun: 0, q_cooldown: 0 }
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
let menuNavCooldown = 0;

// --- EVENTOS DINÁMICOS ---
let dynamicEvents = [];
let helperDrones = [];
let xpMultiplier = 1;
