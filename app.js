// =============================================
// FIREBASE — Imports & Inicialización
// =============================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, arrayUnion,
  collection, query, where, getDocs,
  orderBy, startAt, endAt, documentId,
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAgNRDTub2DFbH_Cg8L3mRvI6oL3gY1-sY',
  authDomain:        'retosdle.firebaseapp.com',
  projectId:         'retosdle',
  storageBucket:     'retosdle.firebasestorage.app',
  messagingSenderId: '515547147113',
  appId:             '1:515547147113:web:54f1a45e086571d8d06bf8',
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const provider    = new GoogleAuthProvider();

const db = getFirestore(firebaseApp);

// =============================================
// CONFIG — Juegos (fuente de verdad única)
// =============================================
const JUEGOS = [
  { id: 'sumplete',       label: 'Sumplete',       icon: 'icons/sumplete.png', url: 'https://sumplete.com/daily' },
  { id: 'shikaku_easy',   label: 'Shikaku Easy',   icon: 'icons/shikaku_easy.png',   url: 'https://shikakuofthe.day/' },
  { id: 'shikaku_medium', label: 'Shikaku Medium',  icon: 'icons/shikaku_medium.png', url: 'https://shikakuofthe.day/' },
  { id: 'cinco',          label: 'Cinco',           icon: 'icons/cinco.png',          url: 'https://embed.puzzlepass.io/eyJwbGF5ZXJJZCI6IktkR2ZjZ0xURElBSVY5cE42MUpuIiwidXNlcklkIjoiYWx2YXJvaXJlZ3VpOTJAZ21haWwuY29tIiwibGFuZ3VhZ2UiOiJlbiJ9?language=en' },
  { id: 'cuordle',        label: 'Cuordle',         icon: 'icons/cuordle.png',        url: 'https://jegomei.github.io/Cuordle/' },
];

const COLORES = [
  // Rojos & naranjas
  '#c62828', // rojo oscuro
  '#e53935', // rojo
  '#bf360c', // terracota
  '#e65100', // naranja quemado
  // Verdes
  '#1b5e20', // verde pino
  '#2e7d32', // verde bosque
  '#33691e', // verde oliva
  // Teals
  '#006064', // cian profundo
  '#00796b', // verde jade
  // Azules
  '#01579b', // azul noche
  '#1565c0', // azul marino
  '#1976d2', // azul (default)
  '#0288d1', // azul cielo
  // Morados & rosas
  '#4527a0', // púrpura oscuro
  '#512da8', // índigo
  '#7b1fa2', // violeta
  '#880e4f', // frambuesa
  '#c2185b', // rosa
  // Neutros
  '#4e342e', // marrón chocolate
  '#37474f', // gris pizarra
];

// Estado de la app
let currentFriend      = null;        // { uid, name }
let currentFriendColor = COLORES[0];  // color del amigo actual (cargado en cargarReto)
let myColor            = COLORES[0];
let myNickname         = '';          // nickname propio (para ordenación alfabética en stats)
let selectedColor      = COLORES[0];
let favoriteUid        = null;        // UID del amigo favorito (pantalla de inicio por defecto)


// =============================================
// AUTH — Login / Logout
// =============================================

async function loginConGoogle() {
  document.getElementById('loginError').textContent = '';
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, provider);
      } catch (redirectErr) {
        console.error('Error en redirect:', redirectErr.code, redirectErr.message);
        document.getElementById('loginError').textContent =
          'No se pudo iniciar sesión. Inténtalo de nuevo.';
      }
    } else {
      console.error('Error en login:', err.code, err.message);
      document.getElementById('loginError').textContent =
        'No se pudo iniciar sesión. Inténtalo de nuevo.';
    }
  }
}

async function cerrarSesion() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  }
}


// =============================================
// AUTH — Observador de estado
// =============================================

getRedirectResult(auth).catch((err) => {
  if (err) {
    console.error('Error en redirect result:', err.code, err.message);
    document.getElementById('loginError').textContent =
      'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    mostrarApp(user);
  } else {
    mostrarLogin();
  }
});

function mostrarApp(user) {
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('appContainer').style.display = 'block';
  document.getElementById('headerTitle').textContent    = 'Perfil';
  renderInstallSection();
  crearPerfilSiNoExiste(user);
}

function hideSplash() {
  const el = document.getElementById('splashScreen');
  if (!el) return;
  el.classList.add('fade-out');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

function mostrarLogin() {
  hideSplash();
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('appContainer').style.display = 'none';
  cerrarJuego();
  volverAlMain(false); // conservar el hash para redirigir tras el login
}


// =============================================
// NAVEGACIÓN — Vista principal ↔ Vista de reto
// =============================================

function abrirReto(friendUid, friendName, updateHash = true) {
  currentFriend = { uid: friendUid, name: friendName };

  document.getElementById('mainView').style.display       = 'none';
  document.getElementById('challengeView').style.display  = 'block';
  document.getElementById('headerTitle').textContent      = `Reto con ${friendName}`;

  // Mostrar "Favorito" solo si este reto NO es ya el favorito
  document.getElementById('btnFavorito').style.display = (friendUid !== favoriteUid) ? 'block' : 'none';

  const hoy = fechaHoy();
  document.getElementById('todayDateLabel').textContent   = formatFecha(hoy);

  if (updateHash) location.hash = 'reto/' + friendUid;

  cargarReto(auth.currentUser.uid, friendUid);
}

function volverAlMain(updateHash = true) {
  currentFriend = null;
  document.getElementById('challengeView').style.display  = 'none';
  document.getElementById('mainView').style.display       = 'block';
  document.getElementById('headerTitle').textContent      = 'Perfil';
  document.getElementById('btnFavorito').style.display    = 'none';
  if (updateHash) history.replaceState(null, '', location.pathname);
}

function abrirStats(year, month) {
  document.getElementById('challengeView').style.display = 'none';
  document.getElementById('statsView').style.display     = 'block';
  document.getElementById('btnFavorito').style.display   = 'none';
  const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('statsMonthLabel').textContent  = `${NOMBRES_MES[month - 1]} ${year}`;
  document.getElementById('headerTitle').textContent      = `Estadísticas con ${currentFriend.name}`;
  cargarStats(auth.currentUser.uid, currentFriend.uid, year, month);
}

function volverAlChallenge() {
  document.getElementById('statsView').style.display      = 'none';
  document.getElementById('challengeView').style.display  = 'block';
  document.getElementById('headerTitle').textContent      = `Reto con ${currentFriend.name}`;
  document.getElementById('btnFavorito').style.display    = (currentFriend.uid !== favoriteUid) ? 'block' : 'none';
}

// Navega al reto indicado en el hash de la URL (#reto/{uid}).
// Devuelve true si navegó, false si no había hash válido.
async function navegarDesdeHash() {
  const hash = location.hash;                   // '#reto/abc123...'
  if (!hash.startsWith('#reto/')) return false;
  const friendUid = hash.slice(6);              // '#reto/' = 6 chars
  if (!friendUid) return false;
  const snap = await getDoc(doc(db, 'users', friendUid));
  if (!snap.exists()) return false;             // uid no válido → queda en main
  const name = snap.data().nickname || snap.data().displayName;
  abrirReto(friendUid, name, false);            // false: no modificar el hash
  return true;
}


// =============================================
// FIRESTORE — Vista de reto: resultados de hoy
// =============================================

async function cargarReto(myUid, friendUid) {
  const hoy = fechaHoy();

  const [mySnap, friendSnap, friendProfileSnap] = await Promise.all([
    getDoc(doc(db, 'results', `${myUid}_${hoy}`)),
    getDoc(doc(db, 'results', `${friendUid}_${hoy}`)),
    getDoc(doc(db, 'users', friendUid)),
  ]);

  const myData      = mySnap.exists()            ? mySnap.data()            : {};
  const friendData  = friendSnap.exists()        ? friendSnap.data()        : {};
  const friendColor = friendProfileSnap.exists() ? (friendProfileSnap.data().color || COLORES[0]) : COLORES[0];
  currentFriendColor = friendColor;

  renderJuegosBotones(myData, friendData, friendColor);
  await cargarHistorial(myUid, friendUid, friendColor);
  cargarMeses(myUid, friendUid);    // sin await: carga en paralelo con la UI ya visible
  cargarRecords(myUid, friendUid);  // sin await: ídem
}

function renderJuegosBotones(myData, friendData, friendColor) {
  const container = document.getElementById('juegosBotones');
  container.innerHTML = '';

  for (const juego of JUEGOS) {
    const myVal     = myData[juego.id]     ?? null;
    const rawFriend = friendData[juego.id] ?? null;

    const btn = document.createElement('button');
    btn.className = 'juego-btn';

    const iconHtml = `<img class="juego-btn-icon" src="${juego.icon}" alt="">`;

    if (myVal === null) {
      btn.classList.add('juego-btn--unplayed');
      btn.innerHTML = `${iconHtml}<div class="juego-btn-text">
                         <span class="juego-btn-name">${juego.label}</span>
                         <span class="juego-btn-status">Toca para jugar →</span>
                       </div>`;
      btn.addEventListener('click', () => abrirJuego(juego.label, juego.url));

    } else if (rawFriend === null) {
      btn.classList.add('juego-btn--waiting');
      btn.innerHTML = `${iconHtml}<div class="juego-btn-text">
                         <span class="juego-btn-name">${juego.label}</span>
                         <span class="juego-btn-status">Tú: ${myVal} · Esperando rival…</span>
                       </div>`;

    } else {
      const iWin        = timeToMs(myVal) <= timeToMs(rawFriend);
      const winnerColor = iWin ? myColor : friendColor;
      btn.classList.add('juego-btn--result');
      btn.style.background = winnerColor;
      const label = iWin ? '🏆 Ganaste' : 'Perdiste';
      btn.innerHTML = `${iconHtml}<div class="juego-btn-text">
                         <span class="juego-btn-name">${juego.label}</span>
                         <span class="juego-btn-status">${label} · Tú: ${myVal} · Rival: ${rawFriend}</span>
                       </div>`;
    }

    container.appendChild(btn);
  }
}

function timeToMs(str) {
  if (!str) return Infinity;
  // Entero puro (ej. Cuordle: número de intentos — menor es mejor)
  if (/^\d+$/.test(str)) return parseInt(str);
  // Tiempo MM:SS o MM:SS.cc
  const m = str.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (!m) return Infinity;
  const mins = parseInt(m[1]);
  const secs = parseInt(m[2]);
  const cent = m[3] ? parseInt(m[3].padEnd(2, '0')) : 0;
  return (mins * 60 + secs) * 1000 + cent * 10;
}


// =============================================
// FIRESTORE — Vista de reto: historial 7 días
// =============================================

async function cargarHistorial(myUid, friendUid, friendColor) {
  const dias = ultimosDias(10);

  const fetches = dias.map(fecha => Promise.all([
    getDoc(doc(db, 'results', `${myUid}_${fecha}`)),
    getDoc(doc(db, 'results', `${friendUid}_${fecha}`)),
  ]));
  const resultados = await Promise.all(fetches);

  const entries = resultados.map(([mySnap, friendSnap], i) => ({
    diasAtras:  i + 1,
    myData:     mySnap.exists()     ? mySnap.data()     : null,
    friendData: friendSnap.exists() ? friendSnap.data() : null,
  }));

  renderHistorial(entries, friendColor);
}

function diaRelativo(diasAtras) {
  if (diasAtras === 1) return 'Ayer';
  return `Hace ${diasAtras} días`;
}

function colorCuadrado(myVal, friendVal, friendColor) {
  const hayYo    = myVal     !== null;
  const hayRival = friendVal !== null;
  if (!hayYo && !hayRival) return '#e0e0e0';       // ninguno jugó → gris
  if ( hayYo && !hayRival) return myColor;          // solo yo jugué
  if (!hayYo &&  hayRival) return friendColor;      // solo rival jugó
  // Ambos jugaron
  const diff = timeToMs(myVal) - timeToMs(friendVal);
  if (diff === 0) return '#e0e0e0';                 // empate → gris
  return diff < 0 ? myColor : friendColor;
}

function renderHistorial(entries, friendColor) {
  const lista = document.getElementById('historyList');
  lista.innerHTML = '';

  if (entries.length === 0) {
    lista.innerHTML = '<p class="empty-msg">Sin resultados anteriores.</p>';
    return;
  }

  // Fila leyenda: icono de cada juego alineado sobre sus cuadrados
  const legend = document.createElement('div');
  legend.className = 'history-row history-legend';
  legend.innerHTML = `
    <span class="history-date"></span>
    <div class="history-squares">
      ${JUEGOS.map(j => `<img class="history-legend-icon" src="${j.icon}" alt="${j.label}" title="${j.label}">`).join('')}
    </div>`;
  lista.appendChild(legend);

  for (const { diasAtras, myData, friendData } of entries) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const squaresHtml = JUEGOS.map(juego => {
      const myVal     = myData?.[juego.id]     ?? null;
      const friendVal = friendData?.[juego.id] ?? null;
      const color     = colorCuadrado(myVal, friendVal, friendColor);
      const myLabel     = myVal     ?? '—';
      const friendLabel = friendVal ?? '—';
      const title = `${juego.label}: ${myLabel} vs ${friendLabel}`;
      return `<div class="history-square" style="background:${color}" title="${title}"></div>`;
    }).join('');

    row.innerHTML = `
      <span class="history-date">${diaRelativo(diasAtras)}</span>
      <div class="history-squares">${squaresHtml}</div>`;
    lista.appendChild(row);
  }
}

// Fecha en zona horaria de Madrid (devuelve YYYY-MM-DD)
// Usa Intl.DateTimeFormat + en-CA (formato ISO, sin depender de sv-SE ni del
// timezone del sistema del navegador).
function fechaHoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

// Últimos n días en zona horaria de Madrid (i=0 → ayer, i=n-1 → hace n días).
// Ancla en el mediodía UTC del día Madrid actual para evitar problemas de DST.
function ultimosDias(n) {
  const hoy    = fechaHoy();                              // 'YYYY-MM-DD'
  const noonMs = new Date(hoy + 'T12:00:00Z').getTime(); // mediodía UTC de hoy (Madrid)
  const fmt    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
  return Array.from({ length: n }, (_, i) =>
    fmt.format(new Date(noonMs - (i + 1) * 86_400_000))
  );
}

// Devuelve un array de strings 'YYYY-MM-DD' para todos los días del mes
function obtenerDiasDelMes(year, month) {
  const numDias = new Date(year, month, 0).getDate(); // día 0 del mes siguiente
  const mm = String(month).padStart(2, '0');
  return Array.from({ length: numDias }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });
}

// Color de un segmento del gráfico circular (mismo criterio que colorCuadrado)
function colorSegmento(myVal, friendVal, friendColor) {
  const myMs = timeToMs(myVal);
  const frMs = timeToMs(friendVal);
  if (myMs === Infinity && frMs === Infinity) return '#e0e0e0';
  if (myMs === Infinity) return friendColor;
  if (frMs === Infinity) return myColor;
  if (myMs === frMs)     return '#e0e0e0';
  return myMs < frMs ? myColor : friendColor;
}

// CSS conic-gradient agrupando victorias: primero el jugador A (alfabético), luego B, luego gris
function crearConicGradient(myData, friendData, friendColor) {
  // Contar victorias de cada jugador
  let myWins = 0, friendWins = 0;
  for (const juego of JUEGOS) {
    const c = colorSegmento(myData?.[juego.id] ?? null, friendData?.[juego.id] ?? null, friendColor);
    if (c === myColor)     myWins++;
    else if (c === friendColor) friendWins++;
  }
  const grays = JUEGOS.length - myWins - friendWins;

  // El jugador alfabéticamente primero ocupa el primer arco (consistencia entre ambas vistas)
  const myFirst = myNickname.localeCompare(currentFriend.name, 'es') <= 0;

  const pct  = 100 / JUEGOS.length; // 20% por juego
  const stops = [];
  let pos = 0;

  const addArc = (color, count) => {
    if (count === 0) return;
    const end = pos + count * pct;
    stops.push(`${color} ${pos}% ${end}%`);
    pos = end;
  };

  if (myFirst) {
    addArc(myColor,     myWins);
    addArc(friendColor, friendWins);
  } else {
    addArc(friendColor, friendWins);
    addArc(myColor,     myWins);
  }
  addArc('#e0e0e0', grays);

  return `conic-gradient(${stops.join(', ')})`;
}

async function cargarStats(myUid, friendUid, year, month) {
  const calGrid = document.getElementById('calGrid');
  calGrid.innerHTML = '<p class="empty-msg">Cargando…</p>';

  const dias = obtenerDiasDelMes(year, month);
  const fetches = dias.map(fecha => Promise.all([
    getDoc(doc(db, 'results', `${myUid}_${fecha}`)),
    getDoc(doc(db, 'results', `${friendUid}_${fecha}`)),
  ]));
  const resultados = await Promise.all(fetches);

  const dataByDay = {};
  dias.forEach((fecha, i) => {
    const [mySnap, friendSnap] = resultados[i];
    const dayNum = parseInt(fecha.split('-')[2]);
    dataByDay[dayNum] = {
      myData:     mySnap.exists()     ? mySnap.data()     : null,
      friendData: friendSnap.exists() ? friendSnap.data() : null,
    };
  });

  renderCalendario(year, month, dataByDay);
}

function renderCalendario(year, month, dataByDay) {
  const calGrid = document.getElementById('calGrid');
  calGrid.innerHTML = '';

  const numDias   = new Date(year, month, 0).getDate();
  const primerDow = new Date(year, month - 1, 1).getDay(); // 0=Dom … 6=Sáb
  // Convertir a semana con inicio lunes: Lun=0 … Dom=6
  const offsetLunes = (primerDow === 0) ? 6 : primerDow - 1;

  // Celdas vacías antes del primer día
  for (let i = 0; i < offsetLunes; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day';
    calGrid.appendChild(empty);
  }

  // Días del mes
  for (let d = 1; d <= numDias; d++) {
    const { myData, friendData } = dataByDay[d];

    const cell   = document.createElement('div');
    cell.className = 'cal-day';

    const circle = document.createElement('div');
    circle.className = 'cal-day-circle';
    if (myData || friendData) {
      circle.style.background = crearConicGradient(myData, friendData, currentFriendColor);
    }

    const num = document.createElement('span');
    num.className   = 'cal-day-num';
    num.textContent = d;

    cell.appendChild(circle);
    cell.appendChild(num);
    calGrid.appendChild(cell);
  }

  // Celdas vacías al final para completar la última fila
  const total     = offsetLunes + numDias;
  const remainder = (7 - (total % 7)) % 7;
  for (let i = 0; i < remainder; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day';
    calGrid.appendChild(empty);
  }

  renderStatCards(dataByDay);
}

function renderStatCards(dataByDay) {
  const container = document.getElementById('statCards');
  container.innerHTML = '';

  const myFirst      = myNickname.localeCompare(currentFriend.name, 'es') <= 0;
  const playerAName  = myFirst ? myNickname         : currentFriend.name;
  const playerAColor = myFirst ? myColor             : currentFriendColor;
  const playerBName  = myFirst ? currentFriend.name  : myNickname;
  const playerBColor = myFirst ? currentFriendColor  : myColor;

  for (const juego of JUEGOS) {
    // Contar solo días donde ambos jugaron ese juego
    let aWins = 0, bWins = 0, jTotal = 0;
    for (const { myData, friendData } of Object.values(dataByDay)) {
      const myVal     = myData?.[juego.id]     ?? null;
      const friendVal = friendData?.[juego.id] ?? null;
      if (myVal === null || friendVal === null) continue;
      jTotal++;
      const myMs = timeToMs(myVal), frMs = timeToMs(friendVal);
      if (myMs < frMs)      { myFirst ? aWins++ : bWins++; }
      else if (frMs < myMs) { myFirst ? bWins++ : aWins++; }
      // Empate exacto de tiempo: cuenta como partida pero no como victoria
    }

    const card = document.createElement('div');
    card.className = 'card';

    // Cabecera: [% ganador izq]  [nombre juego centrado]  [% ganador der]
    const header     = document.createElement('div');
    header.className = 'stat-game-header';

    const cornerLeft  = document.createElement('span');
    cornerLeft.className = 'stat-pct-corner';

    const gameLabel = document.createElement('span');
    gameLabel.className   = 'card-label';
    gameLabel.textContent = juego.label;

    const cornerRight = document.createElement('span');
    cornerRight.className = 'stat-pct-corner stat-pct-corner-right';

    header.appendChild(cornerLeft);
    header.appendChild(gameLabel);
    header.appendChild(cornerRight);
    card.appendChild(header);

    const row = document.createElement('div');
    row.className = 'stat-row';

    const playerAEl = document.createElement('div');
    playerAEl.className = 'stat-player';
    const playerBEl = document.createElement('div');
    playerBEl.className = 'stat-player stat-player-right';

    const meter    = document.createElement('div');
    meter.className = 'stat-meter';
    const sideLeft  = document.createElement('div');
    sideLeft.className = 'stat-side stat-side-left';
    const divider   = document.createElement('div');
    divider.className = 'stat-divider';
    const sideRight = document.createElement('div');
    sideRight.className = 'stat-side stat-side-right';

    if (jTotal > 0 && aWins === bWins) {
      const empLabel = document.createElement('span');
      empLabel.className   = 'stat-empate-label';
      empLabel.textContent = 'empate';
      divider.appendChild(empLabel);
    } else if (aWins !== bWins) {
      const winner        = aWins > bWins ? 'a' : 'b';
      const winnerWins    = winner === 'a' ? aWins  : bWins;
      const winnerColor   = winner === 'a' ? playerAColor : playerBColor;
      const decisiveGames = aWins + bWins;
      const pct           = winnerWins / decisiveGames;
      const numSquares    = Math.min(5, Math.ceil((pct - 0.5) * 10));
      const targetSide    = winner === 'a' ? sideLeft : sideRight;
      const targetCorner  = winner === 'a' ? cornerLeft : cornerRight;

      // Porcentaje en la esquina del ganador, misma línea que el nombre del juego
      targetCorner.style.color = winnerColor;
      targetCorner.textContent = Math.round(pct * 100) + '%';

      // Borde de la tarjeta del color del ganador
      card.style.border = `2px solid ${winnerColor}`;

      for (let i = 0; i < 5; i++) {
        const sq = document.createElement('div');
        sq.className = 'history-square';
        // Left side: transparent squares go first (outer), colored near divider
        // Right side: colored squares go first (near divider), transparent outer
        const colored = winner === 'a' ? i >= (5 - numSquares) : i < numSquares;
        sq.style.background = colored ? winnerColor : 'transparent';
        targetSide.appendChild(sq);
      }
    }
    // Si jTotal === 0: barra sola, sin texto ni cuadros

    const bar = document.createElement('div');
    bar.className = 'stat-bar';
    divider.appendChild(bar);

    const nameAEl = document.createElement('span');
    nameAEl.className   = 'stat-name';
    nameAEl.textContent = playerAName;
    playerAEl.appendChild(nameAEl);

    const nameBEl = document.createElement('span');
    nameBEl.className   = 'stat-name';
    nameBEl.textContent = playerBName;
    playerBEl.appendChild(nameBEl);

    meter.appendChild(sideLeft);
    meter.appendChild(divider);
    meter.appendChild(sideRight);

    row.appendChild(playerAEl);
    row.appendChild(meter);
    row.appendChild(playerBEl);
    card.appendChild(row);
    container.appendChild(card);
  }
}

async function cargarMeses(myUid, friendUid) {
  const lista = document.getElementById('mesesList');
  lista.innerHTML = '<p class="empty-msg">Cargando…</p>';

  // Los documentos tienen ID = '{uid}_{YYYY-MM-DD}'; filtramos por rango de ID
  const queryPorUid = (uid) => query(
    collection(db, 'results'),
    orderBy(documentId()),
    startAt(uid + '_'),
    endAt(uid + '_\uf8ff'),
  );
  const [myDocs, friendDocs] = await Promise.all([
    getDocs(queryPorUid(myUid)),
    getDocs(queryPorUid(friendUid)),
  ]);

  const mesesSet = new Set();
  for (const snap of [...myDocs.docs, ...friendDocs.docs]) {
    // El ID siempre es '{uid}_{YYYY-MM-DD}'; tomamos todo lo que hay tras el primer '_'
    const underscoreIdx = snap.id.indexOf('_');
    const date = underscoreIdx !== -1 ? snap.id.slice(underscoreIdx + 1) : null;
    if (date && date.length >= 7) mesesSet.add(date.slice(0, 7));
  }

  if (mesesSet.size === 0) {
    lista.innerHTML = '<p class="empty-msg">Sin datos aún.</p>';
    return;
  }

  const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  lista.innerHTML = '';
  for (const ym of [...mesesSet].sort().reverse()) {
    const [year, month] = ym.split('-').map(Number);
    const item = document.createElement('div');
    item.className = 'month-item';
    item.innerHTML = `<span class="month-name">${NOMBRES_MES[month - 1]} ${year}</span>
      <button class="btn btn-sm" data-year="${year}" data-month="${month}">Ver estadísticas</button>`;
    lista.appendChild(item);
  }
}

// Devuelve { val, isMe } con el mejor de dos valores, o null si ninguno existe
function mejorEntre(myVal, friendVal) {
  if (!myVal && !friendVal) return null;
  if (myVal && !friendVal)  return { val: myVal,    isMe: true  };
  if (!myVal && friendVal)  return { val: friendVal, isMe: false };
  return timeToMs(myVal) <= timeToMs(friendVal)
    ? { val: myVal,    isMe: true  }
    : { val: friendVal, isMe: false };
}

// Formatea un valor de récord: SS.cc"s" (segundos totales con centésimas), o "X int." para Cuordle
function formatRecord(val, juegoId) {
  if (!val) return '—';
  if (juegoId === 'cuordle') return val + ' int.';
  const m = val.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (!m) return val;
  const totalSecs = parseInt(m[1]) * 60 + parseInt(m[2]);
  const cents = m[3] ? parseInt(m[3].padEnd(2, '0')) : 0;
  return (totalSecs + cents / 100).toFixed(2) + ' s';
}

// Escanea todo el historial de un uid y devuelve el objeto de récords plano
async function construirRecordsDesdeHistorial(uid) {
  const snap = await getDocs(query(
    collection(db, 'results'),
    orderBy(documentId()),
    startAt(uid + '_'),
    endAt(uid + '_\uf8ff'),
  ));
  const recData = {};
  snap.forEach(docSnap => {
    const underscoreIdx = docSnap.id.indexOf('_');
    const date = underscoreIdx !== -1 ? docSnap.id.slice(underscoreIdx + 1) : null;
    if (!date) return;
    const mes = date.slice(0, 7);
    const data = docSnap.data();
    for (const juego of JUEGOS) {
      const val = data[juego.id] ?? null;
      if (!val) continue;
      const ms = timeToMs(val);
      if (ms === Infinity) continue;
      const allTimeKey = juego.id + '_allTime';
      if (!recData[allTimeKey] || ms < timeToMs(recData[allTimeKey])) recData[allTimeKey] = val;
      const mesKey = juego.id + '_' + mes;
      if (!recData[mesKey] || ms < timeToMs(recData[mesKey])) recData[mesKey] = val;
    }
  });
  return recData;
}

async function cargarRecords(myUid, friendUid) {
  const lista = document.getElementById('recordsList');
  lista.innerHTML = '<p class="empty-msg">Cargando…</p>';

  const [myRecSnap, friendRecSnap] = await Promise.all([
    getDoc(doc(db, 'records', myUid)),
    getDoc(doc(db, 'records', friendUid)),
  ]);

  // Si no existe el doc propio → escaneo completo + guardar para futuras cargas
  let myRecData;
  if (myRecSnap.exists()) {
    myRecData = myRecSnap.data();
  } else {
    myRecData = await construirRecordsDesdeHistorial(myUid);
    if (Object.keys(myRecData).length > 0) {
      setDoc(doc(db, 'records', myUid), myRecData); // fire-and-forget: migración inicial
    }
  }

  // Si no existe el doc del amigo → escaneo completo (no podemos guardarlo por él)
  let friendRecData;
  if (friendRecSnap.exists()) {
    friendRecData = friendRecSnap.data();
  } else {
    friendRecData = await construirRecordsDesdeHistorial(friendUid);
  }

  const currentMonth = fechaHoy().slice(0, 7);
  const records = {};
  for (const juego of JUEGOS) {
    const mesKey = juego.id + '_' + currentMonth;
    records[juego.id] = {
      mes: mejorEntre(myRecData[mesKey],               friendRecData[mesKey]),
      abs: mejorEntre(myRecData[juego.id + '_allTime'], friendRecData[juego.id + '_allTime']),
    };
  }

  renderRecords(records);
}

function renderRecords(records) {
  const lista = document.getElementById('recordsList');
  lista.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'record-row record-header';
  header.innerHTML = `
    <div class="record-game"></div>
    <span class="record-col-label">Mes</span>
    <span class="record-col-label">Total</span>`;
  lista.appendChild(header);

  for (const juego of JUEGOS) {
    const rec = records[juego.id];
    const row = document.createElement('div');
    row.className = 'record-row';

    const mesColor = rec.mes ? (rec.mes.isMe ? myColor : currentFriendColor) : '#ccc';
    const absColor = rec.abs ? (rec.abs.isMe ? myColor : currentFriendColor) : '#ccc';

    row.innerHTML = `
      <div class="record-game">
        <img class="history-legend-icon" src="${juego.icon}" alt="${juego.label}">
        <span class="record-game-name">${juego.label}</span>
      </div>
      <span class="record-val" style="color:${mesColor}">${formatRecord(rec.mes?.val, juego.id)}</span>
      <span class="record-val" style="color:${absColor}">${formatRecord(rec.abs?.val, juego.id)}</span>`;
    lista.appendChild(row);
  }
}

function formatFecha(dateStr) {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [, mes, dia] = dateStr.split('-');
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`;
}


// =============================================
// FIRESTORE — Perfil de usuario
// =============================================

async function crearPerfilSiNoExiste(user) {
  const userRef = doc(db, 'users', user.uid);
  const snap    = await getDoc(userRef);

  if (!snap.exists()) {
    const friendCode = user.uid.slice(0, 6).toUpperCase();
    await setDoc(userRef, {
      uid:         user.uid,
      displayName: user.displayName,
      nickname:    user.displayName,
      color:       COLORES[0],
      friendCode,
      friends:     [],
    });
  } else if (!snap.data().nickname) {
    await updateDoc(userRef, {
      nickname: snap.data().displayName,
      color:    COLORES[0],
    });
  }

  await cargarPerfil(user.uid);
  const navegadoPorHash = await navegarDesdeHash();
  // Si no hay hash en la URL, abrir el reto favorito (si hay uno configurado)
  if (!navegadoPorHash && favoriteUid) {
    const favSnap = await getDoc(doc(db, 'users', favoriteUid));
    if (favSnap.exists()) {
      const name = favSnap.data().nickname || favSnap.data().displayName;
      abrirReto(favoriteUid, name, false);
    }
  }
  hideSplash();
}

async function cargarPerfil(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const data = snap.data();

  myColor     = data.color || COLORES[0];
  myNickname  = data.nickname || data.displayName || '';
  favoriteUid = data.favoriteUid || null;
  aplicarColor(myColor);

  document.getElementById('userDisplayName').textContent  = data.nickname || data.displayName;
  document.getElementById('friendCodeDisplay').textContent = data.friendCode;

  renderAmigos(data.friends || []);
}


// =============================================
// PERFIL — Acordeón inline
// =============================================

function toggleProfileCard() {
  const content = document.getElementById('profileContent');
  const arrow   = document.getElementById('profileArrow');
  const toggle  = document.getElementById('profileToggle');
  const isOpen  = content.style.display !== 'none';

  if (isOpen) {
    content.style.display = 'none';
    arrow.classList.remove('open');
    toggle.classList.remove('expanded');
  } else {
    // Pre-rellenar campos con datos actuales
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        document.getElementById('profileNickname').value = data.nickname || data.displayName;
        selectedColor = data.color || COLORES[0];
        renderColorSwatches(selectedColor);
      });
    }
    content.style.display = 'block';
    arrow.classList.add('open');
    toggle.classList.add('expanded');
  }
}

function renderColorSwatches(colorActual) {
  const container = document.getElementById('colorSwatches');
  container.innerHTML = '';
  for (const color of COLORES) {
    const swatch = document.createElement('button');
    swatch.className = 'color-swatch' + (color === colorActual ? ' selected' : '');
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener('click', () => {
      selectedColor = color;
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });
    container.appendChild(swatch);
  }
}

async function guardarPerfil() {
  const user = auth.currentUser;
  if (!user) return;

  const nickname = document.getElementById('profileNickname').value.trim();
  if (!nickname) return;

  await updateDoc(doc(db, 'users', user.uid), {
    nickname,
    color: selectedColor,
  });

  myColor = selectedColor;
  document.getElementById('userDisplayName').textContent = nickname;
  aplicarColor(selectedColor);

  // Colapsar tras guardar
  document.getElementById('profileContent').style.display = 'none';
  document.getElementById('profileArrow').classList.remove('open');
  document.getElementById('profileToggle').classList.remove('expanded');

  mostrar('Perfil guardado ✓');
}


// =============================================
// FIRESTORE — Sistema de amigos
// =============================================

async function renderAmigos(amigos) {
  const lista = document.getElementById('friendsList');

  if (amigos.length === 0) {
    lista.innerHTML = '<p class="empty-msg">Aún no tienes amigos. ¡Añade uno con su código!</p>';
    return;
  }

  lista.innerHTML = '';
  for (const uid of amigos) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) continue;
    const data        = snap.data();
    const friendName  = data.nickname || data.displayName;

    const item = document.createElement('div');
    item.className = 'friend-item';
    item.innerHTML = `
      <span class="friend-name">${friendName}</span>
      <button class="btn btn-sm retar-btn" data-uid="${uid}" data-name="${friendName}">
        Retar
      </button>`;
    lista.appendChild(item);
  }
}

async function añadirAmigo() {
  const input = document.getElementById('friendCodeInput');
  const msg   = document.getElementById('addFriendMsg');
  const code  = input.value.trim().toUpperCase();

  msg.className   = 'form-msg';
  msg.textContent = '';

  if (code.length !== 6) {
    msg.className   = 'form-msg error';
    msg.textContent = 'El código debe tener exactamente 6 caracteres.';
    return;
  }

  const yo     = auth.currentUser;
  const mySnap = await getDoc(doc(db, 'users', yo.uid));
  const myData = mySnap.data();

  if (myData.friendCode === code) {
    msg.className   = 'form-msg error';
    msg.textContent = 'No puedes añadirte a ti mismo.';
    return;
  }

  const q      = query(collection(db, 'users'), where('friendCode', '==', code));
  const result = await getDocs(q);

  if (result.empty) {
    msg.className   = 'form-msg error';
    msg.textContent = 'No existe ningún usuario con ese código.';
    return;
  }

  const friendDoc = result.docs[0];
  const friendUid = friendDoc.id;

  if ((myData.friends || []).includes(friendUid)) {
    msg.className   = 'form-msg error';
    msg.textContent = 'Ya tienes a este usuario como amigo.';
    return;
  }

  await updateDoc(doc(db, 'users', yo.uid),    { friends: arrayUnion(friendUid) });
  await updateDoc(doc(db, 'users', friendUid), { friends: arrayUnion(yo.uid)    });

  input.value     = '';
  msg.className   = 'form-msg success';
  msg.textContent = `¡${friendDoc.data().displayName} añadido como amigo!`;

  await cargarPerfil(yo.uid);
}



function copiarCodigo() {
  const code = document.getElementById('friendCodeDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btnCopyCode');
    const original = btn.textContent;
    btn.textContent = '¡Copiado!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}


// =============================================
// UI — IFRAME DE JUEGOS (overlay fijo)
// =============================================

function abrirJuego(nombre, url) {
  document.getElementById('gameTitle').textContent        = nombre;
  document.getElementById('gameFrame').src                = url;
  document.getElementById('gameContainer').style.display = 'flex';
}

function cerrarJuego() {
  document.getElementById('gameFrame').src                = '';
  document.getElementById('gameContainer').style.display = 'none';
}


// =============================================
// PORTAPAPELES — Parsers por juego
// =============================================

async function leerResultado() {
  try {
    const texto = await navigator.clipboard.readText();
// --- SUMPLETE ---
if (texto.includes('#Sumplete') || texto.includes('#sumplete')) {
  const match = texto.match(/⏱️\s*(\d{2}:\d{2}\.\d{2})/);
  if (match) {
    await guardar({ sumplete: match[1] });
    mostrar(`Sumplete → ${match[1]} ✓`);
    return;
  }
}
    

    // --- SHIKAKU ---
    if (texto.includes('#ShikakuOfTheDay')) {
      const easyMatch   = texto.match(/#EASY\d+\s+⏱️\s+(\d{2}:\d{2}\.\d{2})/);
      const mediumMatch = texto.match(/#MEDIUM\d+\s+⏱️\s+(\d{2}:\d{2}\.\d{2})/);
      const campos = {};
      if (easyMatch)   campos.shikaku_easy   = easyMatch[1];
      if (mediumMatch) campos.shikaku_medium = mediumMatch[1];
      if (Object.keys(campos).length > 0) {
        await guardar(campos);
        mostrar(`Shikaku → Easy: ${campos.shikaku_easy || '—'} · Medium: ${campos.shikaku_medium || '—'} ✓`);
        return;
      }
    }

    // --- CINCO ---
    if (texto.includes('Cinco of the day')) {
      const match = texto.match(/took me (\d{2}:\d{2})/);
      if (match) {
        await guardar({ cinco: match[1] });
        mostrar(`Cinco → ${match[1]} ✓`);
        return;
      }
    }

    // --- CUORDLE ---
    if (texto.includes('Cuordle') && texto.includes('Total:')) {
      const match = texto.match(/Total:\s*(\d+)/);
      if (match) {
        await guardar({ cuordle: match[1] });
        mostrar(`Cuordle → ${match[1]} intentos ✓`);
        return;
      }
    }

    mostrar('No se reconoce el formato del texto copiado.', true);

  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      mostrar('Error al leer el portapapeles (requiere HTTPS).', true);
    } else {
      mostrar('Error al guardar el resultado. Inténtalo de nuevo.', true);
      console.error('leerResultado:', err);
    }
  }
}


// =============================================
// ALMACENAMIENTO — Firestore
// =============================================

async function actualizarRecords(uid, campos, fecha) {
  const recRef  = doc(db, 'records', uid);
  const recSnap = await getDoc(recRef);
  const existing = recSnap.exists() ? recSnap.data() : {};
  const mes = fecha.slice(0, 7);
  const updates = {};

  for (const juego of JUEGOS) {
    const val = campos[juego.id] ?? null;
    if (!val) continue;
    const ms = timeToMs(val);
    if (ms === Infinity) continue;

    const allTimeKey = juego.id + '_allTime';
    if (!existing[allTimeKey] || ms < timeToMs(existing[allTimeKey])) updates[allTimeKey] = val;

    const mesKey = juego.id + '_' + mes;
    if (!existing[mesKey] || ms < timeToMs(existing[mesKey])) updates[mesKey] = val;
  }

  if (Object.keys(updates).length > 0) {
    await setDoc(recRef, updates, { merge: true });
  }
}

async function guardar(campos) {
  const user = auth.currentUser;
  if (!user) { console.warn('guardar: sin usuario autenticado'); return; }

  const hoy = fechaHoy();
  await setDoc(doc(db, 'results', `${user.uid}_${hoy}`), campos, { merge: true });
  await actualizarRecords(user.uid, campos, hoy);

  if (currentFriend) await cargarReto(user.uid, currentFriend.uid);
}


// =============================================
// HELPERS UI — Sección de instalación PWA
// =============================================

function renderInstallSection() {
  const hint = document.getElementById('installHint');

  // Ya instalada como PWA → ocultar instrucciones (el icono sigue visible)
  const isPWA = window.navigator.standalone === true ||
                window.matchMedia('(display-mode: standalone)').matches;
  if (isPWA) {
    hint.style.display = 'none';
    return;
  }

  const isIOS     = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS) {
    hint.innerHTML = 'Instala la app: en <strong>Safari</strong> pulsa <strong>□↑</strong> → <strong>Añadir a pantalla de inicio</strong>';
  } else if (isAndroid) {
    hint.innerHTML = 'Instala la app: en <strong>Chrome</strong> pulsa <strong>⋮</strong> → <strong>Añadir a pantalla de inicio</strong>';
  } else {
    hint.innerHTML = 'Abre esta página en Chrome o Safari desde tu móvil para instalarla.';
  }
  hint.style.display = 'block';
}


// =============================================
// HELPERS UI — Color del usuario
// =============================================

// Devuelve una versión ~18% más oscura de un color hex (para hover)
function darken(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (x) => Math.round(x * 0.82).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

// Aplica el color elegido por el usuario a toda la UI:
// custom properties CSS (botones, topbar) + toggle del perfil
function aplicarColor(color) {
  const root = document.documentElement;
  root.style.setProperty('--user-color',       color);
  root.style.setProperty('--user-color-hover', darken(color));

  // Sincroniza el color del status bar (Android/Chrome PWA y Safari theme)
  document.querySelector('meta[name="theme-color"]').setAttribute('content', color);

  // Toggle del perfil (usa inline style, fuera del flujo de las CSS vars)
  const toggle = document.getElementById('profileToggle');
  if (toggle) {
    toggle.style.background = color;
    document.getElementById('userDisplayName').style.color = 'white';
    document.getElementById('profileArrow').style.color    = 'rgba(255,255,255,0.7)';
  }
}


// =============================================
// HELPERS UI — Toast
// =============================================

let _toastTimer;

function mostrar(texto, esError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = texto;
  toast.className   = 'visible' + (esError ? ' toast-error' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.className = ''; }, 3000);
}


// =============================================
// INIT — Registro de event listeners
// =============================================

// Login / logout
document.getElementById('btnGoogle').addEventListener('click',   loginConGoogle);
document.getElementById('btnSignOut').addEventListener('click',  cerrarSesion);

// Botón home → volver a challenge si estamos en stats, si no al main
document.getElementById('btnHome').addEventListener('click', () => {
  if (document.getElementById('statsView').style.display !== 'none') {
    volverAlChallenge();
  } else {
    volverAlMain();
  }
});

// Toggle perfil inline
document.getElementById('profileToggle').addEventListener('click', toggleProfileCard);

// Guardar perfil
document.getElementById('btnGuardarPerfil').addEventListener('click', guardarPerfil);

// Cerrar juego
document.getElementById('closeBtn').addEventListener('click', cerrarJuego);

// Leer portapapeles (vista de reto)
document.getElementById('btnLeerReto').addEventListener('click', leerResultado);

// Copiar código de amigo
document.getElementById('btnCopyCode').addEventListener('click', copiarCodigo);

// Añadir amigo
document.getElementById('btnAddFriend').addEventListener('click', añadirAmigo);

// Establecer reto favorito (pantalla de inicio al abrir la PWA)
async function establecerFavorito() {
  const user = auth.currentUser;
  if (!user || !currentFriend) return;
  await updateDoc(doc(db, 'users', user.uid), { favoriteUid: currentFriend.uid });
  favoriteUid = currentFriend.uid;
  document.getElementById('btnFavorito').style.display = 'none';
  mostrar('Reto favorito guardado ✓');
}

document.getElementById('btnFavorito').addEventListener('click', establecerFavorito);

// Ver estadísticas de un mes (delegación sobre lista dinámica)
document.getElementById('mesesList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-year]');
  if (!btn) return;
  abrirStats(parseInt(btn.dataset.year), parseInt(btn.dataset.month));
});

// Auto-uppercase + solo alfanumérico en el input del código
document.getElementById('friendCodeInput').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

// Abrir reto con un amigo
document.getElementById('friendsList').addEventListener('click', (e) => {
  const btn = e.target.closest('.retar-btn');
  if (!btn) return;
  abrirReto(btn.dataset.uid, btn.dataset.name);
});

// Hash routing — botón atrás/adelante del navegador
window.addEventListener('hashchange', async () => {
  if (!auth.currentUser) return;           // sin sesión, no hacer nada
  const hash = location.hash;
  if (hash.startsWith('#reto/')) {
    const friendUid = hash.slice(6);
    const snap = await getDoc(doc(db, 'users', friendUid));
    if (!snap.exists()) { volverAlMain(false); return; }
    const name = snap.data().nickname || snap.data().displayName;
    abrirReto(friendUid, name, false);     // false: hash ya es correcto
  } else {
    volverAlMain(false);                   // false: hash ya está vacío
  }
});
