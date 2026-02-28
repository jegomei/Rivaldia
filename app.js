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
  { id: 'sumplete',       label: 'Sumplete',       url: 'https://sumplete.com/' },
  { id: 'shikaku_easy',   label: 'Shikaku Easy',   url: 'https://shikakuofthe.day/' },
  { id: 'shikaku_medium', label: 'Shikaku Medium',  url: 'https://shikakuofthe.day/' },
  { id: 'cinco',          label: 'Cinco',           url: 'https://puzzlepass.io/en/cinco/cinco-medium/?playlist=numbers' },
  { id: 'cuordle',        label: 'Cuordle',         url: 'https://jegomei.github.io/Cuardle/' },
];

const COLORES = [
  '#1976d2', // azul (default)
  '#e53935', // rojo
  '#2e7d32', // verde
  '#7b1fa2', // morado
  '#e65100', // naranja
  '#c2185b', // rosa
  '#00796b', // teal
  '#5d4037', // marrón
];

// Estado de la app
let currentFriend = null; // { uid, name }
let myColor       = COLORES[0];
let selectedColor = COLORES[0];


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
  crearPerfilSiNoExiste(user);
}

function mostrarLogin() {
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('appContainer').style.display = 'none';
  cerrarJuego();
  volverAlMain();
}


// =============================================
// NAVEGACIÓN — Vista principal ↔ Vista de reto
// =============================================

function abrirReto(friendUid, friendName) {
  currentFriend = { uid: friendUid, name: friendName };

  document.getElementById('mainView').style.display       = 'none';
  document.getElementById('challengeView').style.display  = 'block';
  document.getElementById('headerTitle').textContent      = `Reto con ${friendName}`;

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('todayDateLabel').textContent   = formatFecha(hoy);

  cargarReto(auth.currentUser.uid, friendUid);
}

function volverAlMain() {
  currentFriend = null;
  document.getElementById('challengeView').style.display  = 'none';
  document.getElementById('mainView').style.display       = 'block';
  document.getElementById('headerTitle').textContent      = '';
}


// =============================================
// FIRESTORE — Vista de reto: resultados de hoy
// =============================================

async function cargarReto(myUid, friendUid) {
  const hoy = new Date().toISOString().split('T')[0];

  const [mySnap, friendSnap, friendProfileSnap] = await Promise.all([
    getDoc(doc(db, 'results', `${myUid}_${hoy}`)),
    getDoc(doc(db, 'results', `${friendUid}_${hoy}`)),
    getDoc(doc(db, 'users', friendUid)),
  ]);

  const myData      = mySnap.exists()            ? mySnap.data()            : {};
  const friendData  = friendSnap.exists()        ? friendSnap.data()        : {};
  const friendColor = friendProfileSnap.exists() ? (friendProfileSnap.data().color || COLORES[0]) : COLORES[0];

  renderJuegosBotones(myData, friendData, friendColor);
  await cargarHistorial(myUid, friendUid);
}

function renderJuegosBotones(myData, friendData, friendColor) {
  const container = document.getElementById('juegosBotones');
  container.innerHTML = '';

  for (const juego of JUEGOS) {
    const myVal     = myData[juego.id]     ?? null;
    const rawFriend = friendData[juego.id] ?? null;

    const btn = document.createElement('button');
    btn.className = 'juego-btn';

    if (myVal === null) {
      btn.classList.add('juego-btn--unplayed');
      btn.innerHTML = `<span class="juego-btn-name">${juego.label}</span>
                       <span class="juego-btn-status">Toca para jugar →</span>`;
      btn.addEventListener('click', () => abrirJuego(juego.label, juego.url));

    } else if (rawFriend === null) {
      btn.classList.add('juego-btn--waiting');
      btn.innerHTML = `<span class="juego-btn-name">${juego.label}</span>
                       <span class="juego-btn-status">Tú: ${myVal} · Esperando rival…</span>`;

    } else {
      const iWin        = timeToMs(myVal) <= timeToMs(rawFriend);
      const winnerColor = iWin ? myColor : friendColor;
      btn.classList.add('juego-btn--result');
      btn.style.background = winnerColor;
      const label = iWin ? '🏆 Ganaste' : 'Perdiste';
      btn.innerHTML = `<span class="juego-btn-name">${juego.label}</span>
                       <span class="juego-btn-status">${label} · Tú: ${myVal} · Rival: ${rawFriend}</span>`;
    }

    container.appendChild(btn);
  }
}

function timeToMs(str) {
  if (!str) return Infinity;
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

async function cargarHistorial(myUid, friendUid) {
  const dias = ultimosDias(7);

  const fetches = dias.map(fecha => Promise.all([
    getDoc(doc(db, 'results', `${myUid}_${fecha}`)),
    getDoc(doc(db, 'results', `${friendUid}_${fecha}`)),
  ]));
  const resultados = await Promise.all(fetches);

  const conDatos = resultados
    .map(([mySnap, friendSnap], i) => ({
      fecha:      dias[i],
      myData:     mySnap.exists()     ? mySnap.data()     : null,
      friendData: friendSnap.exists() ? friendSnap.data() : null,
    }))
    .filter(({ myData, friendData }) => myData || friendData);

  renderHistorial(conDatos);
}

function renderHistorial(dias) {
  const lista = document.getElementById('historyList');

  if (dias.length === 0) {
    lista.innerHTML = '<p class="empty-msg">Sin resultados anteriores.</p>';
    return;
  }

  lista.innerHTML = '';
  for (const { fecha, myData, friendData } of dias) {
    const item = document.createElement('div');
    item.className = 'history-day';

    const pillsHtml = JUEGOS.map(juego => {
      const myVal     = myData?.[juego.id]     ?? null;
      const friendVal = friendData?.[juego.id] ?? null;
      if (!myVal && !friendVal) return '';

      let clase = '';
      if (myVal && friendVal) {
        clase = timeToMs(myVal) <= timeToMs(friendVal) ? 'win' : 'lose';
      }
      const texto = myVal && friendVal
        ? `${juego.label}: ${myVal} vs ${friendVal}`
        : `${juego.label}: ${myVal ?? '—'} / ${friendVal ?? 'Pendiente'}`;

      return `<span class="pill ${clase}">${texto}</span>`;
    }).join('');

    item.innerHTML = `
      <span class="history-date">${formatFecha(fecha)}</span>
      <div class="history-pills">${pillsHtml || '<span class="pill">Sin actividad</span>'}</div>`;
    lista.appendChild(item);
  }
}

function ultimosDias(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    return d.toISOString().split('T')[0];
  });
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
}

async function cargarPerfil(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const data = snap.data();

  myColor = data.color || COLORES[0];

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
  const isOpen  = content.style.display !== 'none';

  if (isOpen) {
    content.style.display = 'none';
    arrow.classList.remove('open');
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

  // Colapsar tras guardar
  document.getElementById('profileContent').style.display = 'none';
  document.getElementById('profileArrow').classList.remove('open');

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
    const { displayName } = snap.data();

    const item = document.createElement('div');
    item.className = 'friend-item';
    item.innerHTML = `
      <span class="friend-name">${displayName}</span>
      <button class="btn btn-sm btn-success retar-btn" data-uid="${uid}" data-name="${displayName}">
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


// =============================================
// ⚠️ DEV ONLY — borrar antes de producción
// =============================================

async function crearAmigoFicticio() {
  const btn = document.getElementById('btnCrearFake');
  const msg = document.getElementById('devMsg');
  btn.disabled = true;

  const fakeUid  = 'fake_' + Date.now();
  const names    = ['Carlos Test', 'María Test', 'Jugador Bot', 'Rival Demo'];
  const fakeName = names[Math.floor(Math.random() * names.length)];
  const fakeCode = 'TEST' + String(Math.floor(Math.random() * 100)).padStart(2, '0');

  await setDoc(doc(db, 'users', fakeUid), {
    uid:         fakeUid,
    displayName: fakeName,
    nickname:    fakeName,
    color:       COLORES[Math.floor(Math.random() * COLORES.length)],
    friendCode:  fakeCode,
    friends:     [],
  });

  msg.textContent = `✓ Creado: ${fakeName} | Código: ${fakeCode}`;
  btn.disabled = false;
}

// /DEV ONLY

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
    if (texto.includes('#sumplete')) {
      const match = texto.match(/in\s+(\d{2}:\d{2}\.\d{2})/);
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

    // --- CUORDLE --- (parser pendiente)

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

async function guardar(campos) {
  const user = auth.currentUser;
  if (!user) { console.warn('guardar: sin usuario autenticado'); return; }

  const hoy = new Date().toISOString().split('T')[0];
  await setDoc(doc(db, 'results', `${user.uid}_${hoy}`), campos, { merge: true });

  if (currentFriend) await cargarReto(user.uid, currentFriend.uid);
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

// Botón home → volver a vista principal
document.getElementById('btnHome').addEventListener('click', volverAlMain);

// Toggle perfil inline
document.getElementById('profileToggle').addEventListener('click', toggleProfileCard);

// Guardar perfil
document.getElementById('btnGuardarPerfil').addEventListener('click', guardarPerfil);

// Cerrar juego
document.getElementById('closeBtn').addEventListener('click', cerrarJuego);

// Leer portapapeles (en ambas vistas)
document.getElementById('btnLeer').addEventListener('click',     leerResultado);
document.getElementById('btnLeerReto').addEventListener('click', leerResultado);

// Copiar código de amigo
document.getElementById('btnCopyCode').addEventListener('click', copiarCodigo);

// Añadir amigo
document.getElementById('btnAddFriend').addEventListener('click', añadirAmigo);

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

// ⚠️ DEV ONLY
document.getElementById('btnCrearFake').addEventListener('click', crearAmigoFicticio);
