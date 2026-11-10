'use strict';
/* =========================================================
   Círculo — tu diario privado de personas, emociones y límites.
   Todo se guarda solo en este dispositivo (localStorage).
   ========================================================= */

// ---------- Utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY = 864e5;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const iso = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
const daysAgo = s => daysBetween(s, iso());
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const plural = (n, a, b) => (n === 1 ? a : b);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = s => {
  const n = daysAgo(s);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Ayer';
  if (n === -1) return 'Mañana';
  const d = parseISO(s);
  if (n > 1 && n < 7) return cap(d.toLocaleDateString('es', { weekday: 'long' }));
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es', opts);
};
const fmtLong = s => cap(parseISO(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const CHEV = '<svg class="chev" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5l-5 5"/></svg>';

// ---------- Datos ----------
const KEY = 'circulo.v1';
const blank = () => ({ people: [], entries: [], moods: [], pauses: [], settings: { name: '', pinHash: null }, dismissed: {} });
let db = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    const b = blank();
    return raw ? { ...b, ...raw, settings: { ...b.settings, ...(raw.settings || {}) } } : b;
  } catch { return blank(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('⚠️ No se pudo guardar'); }
}
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

// ---------- Catálogos ----------
const TYPES = {
  conversacion: { label: 'Conversación', short: 'Plática', emoji: '💬', color: '#0a84ff', ask: '¿De qué hablaron? ¿Qué le dijiste?' },
  confie:       { label: 'Le confié algo', short: 'Confié', emoji: '🤫', color: '#5e5ce6', ask: '¿Qué le confiaste?' },
  confese:      { label: 'Confesé algo', short: 'Confesé', emoji: '🙏', color: '#bf5af2', ask: '¿Qué confesaste?' },
  chisme:       { label: 'Me contaron un chisme', short: 'Chisme', emoji: '👂', color: '#ff9f0a', ask: '¿Qué te contaron?' },
  salida:       { label: 'Salimos', short: 'Salida', emoji: '🎉', color: '#30d158', ask: '¿A dónde fueron? ¿Cómo la pasaste?' },
  bien:         { label: 'Me hizo sentir bien', short: 'Bien', emoji: '💚', color: '#34c759', ask: '¿Qué hizo o dijo?' },
  mal:          { label: 'Me hizo sentir mal', short: 'Mal', emoji: '💔', color: '#ff375f', ask: '¿Qué pasó?' },
  cortante:     { label: 'Me respondió cortante o feo', short: 'Cortante', emoji: '🧊', color: '#40c8e0', ask: '¿Qué te dijo o cómo te respondió?' },
  traicion:     { label: 'Rompió mi confianza', short: 'Traición', emoji: '🗡️', color: '#ff3b30', ask: '¿Qué hizo? (contó un secreto, mintió…)' },
  enojo:        { label: 'Me enojé', short: 'Enojo', emoji: '😠', color: '#ff6b00', ask: '¿Por qué te enojaste?' },
  mepase:       { label: 'Me pasé / me equivoqué', short: 'Me pasé', emoji: '🫣', color: '#e6b800', ask: '¿Qué hiciste o dijiste?' },
  promesa:      { label: 'Promesa', short: 'Promesa', emoji: '🤝', color: '#a2845e', ask: '¿Qué se prometió?' },
};
const NEG = ['mal', 'cortante', 'traicion'];
const SEV = ['Leve', 'Poco', 'Medio', 'Fuerte', 'Muy fuerte'];
const FEEL = [{ v: -2, e: '😣' }, { v: -1, e: '🙁' }, { v: 0, e: '😐' }, { v: 1, e: '🙂' }, { v: 2, e: '😄' }];
const MOODS = [
  { v: 1, e: '😞', label: 'Muy mal', c: '#ff3b30' },
  { v: 2, e: '😕', label: 'Mal', c: '#ff9f0a' },
  { v: 3, e: '😐', label: 'Normal', c: '#ffcc00' },
  { v: 4, e: '🙂', label: 'Bien', c: '#34c759' },
  { v: 5, e: '🤩', label: 'Increíble', c: '#5e5ce6' },
];
const EMOTIONS = ['Feliz', 'Tranquilo', 'Agradecido', 'Emocionado', 'Querido', 'Orgulloso', 'Ansioso', 'Estresado', 'Triste', 'Solo', 'Enojado', 'Celoso', 'Cansado', 'Confundido', 'Inseguro'];
const TRUST = {
  1: { label: 'No confiar', c: '#ff3b30', dot: '🔴' },
  2: { label: 'Muy poca', c: '#ff9f0a', dot: '🟠' },
  3: { label: 'Con cuidado', c: '#ffcc00', dot: '🟡' },
  4: { label: 'Confío', c: '#34c759', dot: '🟢' },
  5: { label: 'Total', c: '#30b0c7', dot: '💎' },
};
const RELATIONS = ['Amigo/a', 'Mejor amigo/a', 'Familia', 'Pareja', 'Trabajo', 'Escuela', 'Conocido/a', 'Ex'];
const GRADS = [['#ff9a9e', '#f6416c'], ['#a18cd1', '#6a5cff'], ['#43e97b', '#16a085'], ['#fccb90', '#d57eeb'], ['#5ee7df', '#4a6cf7'], ['#f6d365', '#fda085'], ['#89f7fe', '#3b82f6'], ['#fd6585', '#8e2de2'], ['#38f9d7', '#0ba360'], ['#fa709a', '#fbb034']];

const LEVELS = [
  { name: 'Espacio corto', emoji: '🌤️', todo: [
    ['🧘', 'No contestes en caliente. Responde cuando ya estés tranquilo.'],
    ['🙅', 'Hoy no busques tú la conversación.'],
    ['💭', 'Pregúntate: ¿fue algo personal o tuvo un mal día?'],
  ] },
  { name: 'Pausa', emoji: '⏸️', todo: [
    ['💬', 'Responde solo lo necesario, de forma amable y breve.'],
    ['🔒', 'No le cuentes cosas personales en estos días.'],
    ['📅', 'No propongas planes; si te invita, puedes decir “esta vez no”.'],
    ['🧭', 'Al terminar, revisa cómo te sientes antes de volver a acercarte.'],
  ] },
  { name: 'Distancia', emoji: '🚧', todo: [
    ['🔕', 'Silencia sus chats e historias para no estar pendiente.'],
    ['🔒', 'Nada de secretos ni temas delicados con esta persona.'],
    ['🙂', 'Si te busca: educado, corto y sin dar explicaciones de más.'],
    ['💚', 'Pasa ese tiempo con gente que sí te hace bien.'],
  ] },
  { name: 'Distancia larga', emoji: '🛑', todo: [
    ['🔕', 'Silencia o archiva la conversación.'],
    ['🔒', 'Trátala como “conocido”: nada personal.'],
    ['🧠', 'Pregúntate con honestidad si esta relación te suma o te resta.'],
    ['🗣️', 'Si quieres conservarla, habla claro sobre lo que pasó cuando estés listo.'],
  ] },
];

// Guía de límites: situación → frases y cómo sostenerlo
const LIMITS = {
  cortante: { emoji: '🧊', title: 'Me respondió cortante o feo', intro: 'A veces es un mal día; si se repite, es una forma de tratarte.',
    say: ['Noté que me contestaste seco. ¿Está todo bien entre nosotros?', 'No me gusta cómo me hablaste. Con gusto platico contigo cuando sea con respeto.', 'Prefiero dejar esta conversación aquí. Cuando estemos tranquilos la retomamos.'],
    hold: 'Si se repite, no persigas la conversación: responde corto y date espacio.' },
  mal: { emoji: '💔', title: 'Me hizo sentir mal', intro: 'Tus sentimientos son información, no exageración.',
    say: ['Lo que dijiste me hizo sentir mal. Te pido que no se repita.', 'Cuando haces eso, me siento menospreciado. Necesito que me hables diferente.', 'Si vuelve a pasar, voy a tomar distancia.'],
    hold: 'Di la consecuencia una sola vez y cúmplela si se repite. Sin amenazas, solo hechos.' },
  traicion: { emoji: '🗡️', title: 'Contó mi secreto o me mintió', intro: 'La confianza se gana despacio y se pierde rápido.',
    say: ['Te conté eso en confianza y lo compartiste. Por ahora no voy a contarte cosas personales.', 'Me dolió lo que hiciste. Necesito tiempo para volver a confiar.'],
    hold: 'Baja su nivel de confianza en la app y no le compartas nada delicado hasta que lo gane de nuevo.' },
  burla: { emoji: '😒', title: 'Se burla de mí o me critica', intro: 'Las bromas que duelen no son bromas.',
    say: ['Eso no me da risa. No hagas bromas sobre eso, por favor.', 'Si tienes algo que decirme, dímelo en privado y con respeto.'],
    hold: 'Si sigue, no rías por compromiso: cambia de tema o retírate.' },
  dinero: { emoji: '💸', title: 'Me pide dinero o favores seguido', intro: 'Ayudar está bien; sentirte usado no.',
    say: ['Esta vez no puedo prestarte.', 'Primero necesito que me pagues lo anterior.', 'No puedo con eso, pero te ayudo a buscar otra opción.'],
    hold: '“No” es una respuesta completa. No necesitas una excusa.' },
  presion: { emoji: '🍻', title: 'Me presionan (salir, tomar, hacer algo)', intro: 'Tu cuerpo, tu tiempo y tus decisiones son tuyos.',
    say: ['No, gracias. Hoy no me late.', 'Ya te dije que no. Si insistes, me voy.', 'Me la paso bien con ustedes, pero eso no lo voy a hacer.'],
    hold: 'Repite tu “no” con la misma calma. Quien te respeta, deja de insistir.' },
  plantones: { emoji: '⏰', title: 'Me cancelan o me dejan plantado', intro: 'Tu tiempo también vale.',
    say: ['Me quedé esperando. La próxima vez avísame con tiempo, por favor.', 'Ya van varias veces. Prefiero que me digas que no a que me canceles.'],
    hold: 'A la tercera, deja de proponer tú los planes y observa si la otra persona se esfuerza.' },
  interes: { emoji: '🎣', title: 'Solo me busca cuando necesita algo', intro: 'Las relaciones son de ida y vuelta.',
    say: ['Siento que solo me buscas cuando necesitas algo. Me gustaría que también estuvieras en lo bueno.', 'Esta vez no puedo ayudarte.'],
    hold: 'Registra en la app cuándo te busca y para qué. Los datos te van a dar claridad.' },
  privacidad: { emoji: '🔐', title: 'Invade mi privacidad', intro: 'Tienes derecho a tu espacio.',
    say: ['Eso es personal y prefiero no hablarlo.', 'No revises mis cosas, por favor.', 'Te cuento cuando yo quiera contarlo.'],
    hold: 'No tienes que dar explicaciones de tu vida privada.' },
  yo: { emoji: '😤', title: 'Cuando el que se pasa soy yo', intro: 'Reconocerlo te hace más fuerte, no más débil.',
    say: ['Me pasé con lo que dije. Lo siento, no estuvo bien. ¿Cómo lo puedo reparar?', 'Estoy molesto y no quiero decir algo de lo que me arrepienta. Lo hablamos más tarde.'],
    hold: 'Pide perdón sin “pero”. Y cuando te enojes: espera 10 minutos antes de responder.' },
};

const LIMIT_TIPS = [
  ['🗣️', 'Habla en primera persona: “yo siento…” en lugar de “tú siempre…”.'],
  ['✂️', 'Sé breve. Un límite no necesita un discurso ni justificarse de más.'],
  ['⚖️', 'Di la consecuencia y cúmplela. Si no la cumples, el límite desaparece.'],
  ['🌡️', 'No pongas límites en caliente; espera a estar tranquilo.'],
  ['💚', 'Un límite no es un castigo: es cuidarte a ti.'],
  ['🔁', 'Es normal que la otra persona se incomode al principio. Sostenlo.'],
];

// ---------- Personas y estadísticas ----------
const person = id => db.people.find(p => p.id === id);
const entriesOf = id => db.entries.filter(e => e.people?.includes(id));
const isNeg = e => NEG.includes(e.type) || (e.feel ?? 0) < 0;
const isPos = e => e.type === 'bien' || (!NEG.includes(e.type) && (e.feel ?? 0) > 0);
function initials(n) { return n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function grad(p) { const h = [...p.name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length; return GRADS[h]; }
function avatar(p, size = 44, ring = false) {
  if (!p) return '';
  const [a, b] = grad(p);
  const r = ring ? `<span class="ring" style="--ring:${TRUST[p.trust].c}"></span>` : '';
  return `<span class="avatar" style="--s:${size}px;background:linear-gradient(135deg,${a},${b})">${esc(p.emoji || initials(p.name))}${r}</span>`;
}
function statsOf(id, days = 9999) {
  const list = entriesOf(id).filter(e => daysAgo(e.date) <= days);
  return {
    total: list.length,
    pos: list.filter(isPos).length,
    neg: list.filter(isNeg).length,
    secrets: list.filter(e => (e.type === 'confie' || e.type === 'confese')).length,
    gossip: list.filter(e => e.type === 'chisme').length,
    betrayals: list.filter(e => e.type === 'traicion').length,
    broken: list.filter(e => e.type === 'promesa' && e.promiseBy === 'otro' && e.promiseStatus === 'rota').length,
    lastSeen: list.filter(e => e.type === 'salida').map(e => e.date).sort().pop() || null,
    lastAny: list.map(e => e.date).sort().pop() || null,
  };
}
const activePause = id => db.pauses.find(p => p.personId === id && !p.ended && daysAgo(p.start) < p.days);
const pauseLeft = p => p.days - daysAgo(p.start);

// ---------- Motor de recomendaciones ----------
function recommendFor(entry) {
  if (!NEG.includes(entry.type)) return [];
  const sev = entry.severity || 3;
  const BASE = { cortante: [1, 1, 2, 3, 5], mal: [1, 2, 3, 5, 7], traicion: [7, 10, 14, 21, 30] };
  return (entry.people || []).map(pid => {
    const p = person(pid); if (!p) return null;
    const hist = entriesOf(pid).filter(e => e.id !== entry.id);
    const neg30 = hist.filter(e => isNeg(e) && daysAgo(e.date) <= 30).length;
    const pos30 = hist.filter(e => isPos(e) && daysAgo(e.date) <= 30).length;
    const neg90 = hist.filter(e => isNeg(e) && daysAgo(e.date) <= 90).length + 1;
    const pos90 = hist.filter(e => isPos(e) && daysAgo(e.date) <= 90).length;
    let days = BASE[entry.type][sev - 1];
    const why = [['📏', `Intensidad “${SEV[sev - 1].toLowerCase()}”: punto de partida ${days} ${plural(days, 'día', 'días')}.`]];
    if (neg30 === 1) { days *= 1.5; why.push(['🔁', 'Ya pasó algo parecido este mes.']); }
    else if (neg30 >= 2) { days *= 2; why.push(['⚠️', `Es la ${neg30 + 1}ª vez este mes: ya es un patrón.`]); }
    if (pos30 >= 3 && pos30 > neg30 * 2) { days *= 0.75; why.push(['💚', 'Normalmente te hace sentir bien, por eso menos tiempo.']); }
    if (entry.myPart) { days *= 0.5; why.push(['🤝', 'Tú también tuviste parte: más que alejarte, conviene hablarlo.']); }
    days = clamp(Math.round(days), 1, 45);
    const level = days <= 2 ? 0 : days <= 7 ? 1 : days <= 21 ? 2 : 3;
    let trustTo = null;
    if (entry.type === 'traicion') trustTo = Math.min(p.trust, 2);
    else if (neg30 >= 2 || sev >= 4) trustTo = Math.max(1, p.trust - 1);
    if (trustTo === p.trust) trustTo = null;
    const pattern = neg90 >= 4 && neg90 > pos90;
    return { p, days, level, why, trustTo, pattern, limitKey: entry.type };
  }).filter(Boolean);
}

// Consejo general sobre una persona (en cualquier momento)
function adviceFor(id) {
  const p = person(id); const s = statsOf(id, 90);
  const score = s.pos - s.neg * 1.5 - s.betrayals * 4 - s.gossip - s.broken;
  let verdict, color, emoji, text, days = 0, trust = p.trust;
  if (s.total < 3) {
    verdict = 'Aún hay pocos datos'; emoji = '🌱'; color = '#8e8e93';
    text = 'Registra más momentos con esta persona para que pueda darte un consejo con fundamento.';
  } else if (s.betrayals > 0 || (s.neg >= 3 && s.neg > s.pos)) {
    verdict = 'Esta relación te está costando'; emoji = '🚧'; color = '#ff375f';
    text = `En los últimos 3 meses: ${s.neg} momentos malos contra ${s.pos} buenos.` + (s.betrayals ? ' Además rompió tu confianza.' : '');
    days = clamp(s.neg * 3 + s.betrayals * 7, 3, 30);
    trust = Math.min(p.trust, s.betrayals ? 2 : 3);
  } else if (score >= 3 && s.neg === 0) {
    verdict = 'Relación sana'; emoji = '💚'; color = '#34c759';
    text = `${s.pos} momentos buenos y ninguno malo en 3 meses. Cuídala y díselo.`;
    trust = Math.max(p.trust, 4);
  } else {
    verdict = 'Equilibrada, con atención'; emoji = '⚖️'; color = '#ff9f0a';
    text = `${s.pos} momentos buenos y ${s.neg} malos en 3 meses. Pon atención a cómo te sientes después de verla.`;
  }
  const notes = [];
  if (s.gossip >= 2) notes.push(['👂', `Te ha contado ${s.gossip} chismes. Quien te cuenta de otros, puede contar de ti.`]);
  if (s.broken >= 2) notes.push(['🤝', `Ha roto ${s.broken} promesas. Ojo con lo que esperas de ella.`]);
  if (s.secrets >= 3 && p.trust <= 3) notes.push(['🤫', `Le has contado ${s.secrets} cosas personales y su confianza es “${TRUST[p.trust].label.toLowerCase()}”.`]);
  if (s.lastSeen && daysAgo(s.lastSeen) > 45 && score > 0) notes.push(['📅', `No salen desde hace ${daysAgo(s.lastSeen)} días. Quizá es buen momento para verse.`]);
  return { p, s, verdict, color, emoji, text, days, trust, notes };
}

// ---------- Alertas ----------
function computeAlerts() {
  const A = [];
  const recent = d => db.entries.filter(e => daysAgo(e.date) <= d && daysAgo(e.date) >= 0);
  const wk = recent(7), two = recent(14);
  const name = id => person(id)?.name || 'alguien';

  // Pausas terminadas
  db.pauses.filter(p => !p.ended && daysAgo(p.start) >= p.days).forEach(pz => {
    A.push({ id: 'pz-end-' + pz.id, lvl: 'info', c: '#5e5ce6', icon: '⏰', title: `Terminó tu pausa con ${name(pz.personId)}`,
      body: '¿Cómo te sientes? Puedes volver a acercarte poco a poco, o darte más tiempo.',
      acts: [['Me siento bien', 'endPause', pz.id], ['7 días más', 'extendPause', pz.id]] });
  });
  // Rompí una pausa
  db.pauses.filter(pz => !pz.ended && daysAgo(pz.start) < pz.days).forEach(pz => {
    const broke = db.entries.find(e => e.people?.includes(pz.personId) && ['conversacion', 'salida', 'confie', 'confese'].includes(e.type) && e.date >= pz.start && e.created > pz.created);
    if (broke) A.push({ id: 'pz-broke-' + pz.id + broke.id, lvl: 'warn', c: '#ff9f0a', icon: '🚦', title: `Rompiste tu pausa con ${name(pz.personId)}`,
      body: 'No pasa nada, pero pregúntate si fue por gusto o por costumbre. La pausa era para cuidarte.' });
  });
  // Secretos a personas de poca confianza
  two.filter(e => (e.type === 'confie' || e.type === 'confese')).forEach(e => {
    (e.people || []).forEach(pid => { const p = person(pid); if (p && p.trust <= 2)
      A.push({ id: 'sec-low-' + e.id + pid, lvl: 'danger', c: '#ff3b30', icon: '🤐', title: `Le contaste algo personal a ${p.name}`,
        body: `Su confianza es “${TRUST[p.trust].label.toLowerCase()}”. Piensa dos veces antes de contarle más.` }); });
  });
  // Estoy contando mucho
  const secretsWk = wk.filter(e => e.type === 'confie' || e.type === 'confese');
  if (secretsWk.length >= 3) A.push({ id: 'sec-many-' + iso().slice(0, 8) + Math.floor(new Date().getDate() / 7), lvl: 'warn', c: '#5e5ce6', icon: '🫢',
    title: 'Estás contando mucho', body: `${secretsWk.length} cosas personales esta semana a ${new Set(secretsWk.flatMap(e => e.people || [])).size} personas. No todo el mundo necesita saber todo.` });
  // Me repitieron/repetí chismes
  const gossipWk = wk.filter(e => e.type === 'chisme');
  if (gossipWk.length >= 3) A.push({ id: 'gos-wk-' + iso().slice(0, 8) + Math.floor(new Date().getDate() / 7), lvl: 'warn', c: '#ff9f0a', icon: '👂',
    title: 'Mucho chisme a tu alrededor', body: `${gossipWk.length} chismes esta semana. Los chismes desgastan: intenta no repetirlos.` });
  const iSpread = two.filter(e => e.type === 'chisme' && e.repeated);
  if (iSpread.length >= 2) A.push({ id: 'gos-me-' + iSpread.map(e => e.id).join(''), lvl: 'warn', c: '#ff9f0a', icon: '🫣',
    title: 'Te estás pasando con los chismes', body: `Repetiste ${iSpread.length} chismes en dos semanas. Eso puede dañar tu confianza con otros.` });
  // Enojos frecuentes / sin resolver
  const angerWk = wk.filter(e => e.type === 'enojo');
  if (angerWk.length >= 3) A.push({ id: 'ang-' + angerWk.map(e => e.id).join(''), lvl: 'warn', c: '#ff6b00', icon: '🌋',
    title: 'Te has enojado seguido', body: `${angerWk.length} enojos esta semana. Quizá estás cansado o cargando algo. Duerme bien y date espacio antes de responder.` });
  db.entries.filter(e => e.type === 'enojo' && !e.resolved && daysAgo(e.date) >= 3 && daysAgo(e.date) <= 30).forEach(e => {
    A.push({ id: 'ang-open-' + e.id, lvl: 'info', c: '#ff6b00', icon: '🧩', title: 'Tienes un enojo sin resolver',
      body: `Del ${fmtDate(e.date).toLowerCase()}: “${esc((e.text || '').slice(0, 60))}”. ¿Ya lo hablaste o lo soltaste?`, acts: [['Ya se resolvió', 'resolveEntry', e.id]] });
  });
  // Me pasé
  const mePase = two.filter(e => e.type === 'mepase');
  if (mePase.length >= 2) A.push({ id: 'me-' + mePase.map(e => e.id).join(''), lvl: 'warn', c: '#e6b800', icon: '🫣',
    title: 'Te estás pasando', body: `${mePase.length} veces en dos semanas sentiste que te pasaste. Baja el ritmo, descansa y repara lo que puedas.`, acts: [['Cómo reparar', 'openLimit', 'yo']] });
  db.entries.filter(e => e.type === 'mepase' && !e.repaired && daysAgo(e.date) >= 1 && daysAgo(e.date) <= 21).forEach(e => {
    A.push({ id: 'me-open-' + e.id, lvl: 'info', c: '#e6b800', icon: '🩹', title: 'Algo pendiente de reparar',
      body: `“${esc((e.text || '').slice(0, 70))}”. Una disculpa a tiempo vale mucho.`, acts: [['Ya lo reparé', 'repairEntry', e.id]] });
  });
  // Ánimo
  const moods = db.moods.filter(m => daysAgo(m.date) <= 7);
  if (moods.length >= 3) {
    const avg = moods.reduce((a, m) => a + m.mood, 0) / moods.length;
    const veryLow = moods.filter(m => m.mood === 1).length;
    if (veryLow >= 4) A.push({ id: 'mood-vlow-' + iso(), lvl: 'danger', c: '#ff375f', icon: '🫂', title: 'Han sido días muy difíciles',
      body: 'Llevas varios días sintiéndote muy mal. Habla hoy con alguien de confianza. Si sientes que no puedes más, busca a un profesional o una línea de ayuda de tu país. No tienes que cargarlo solo.' });
    else if (avg <= 2.4) A.push({ id: 'mood-low-' + iso(), lvl: 'warn', c: '#ff9f0a', icon: '🌧️', title: 'Semana pesada',
      body: `Tu ánimo promedio esta semana es ${avg.toFixed(1)} de 5. ${bestPerson() ? `Pasa tiempo con ${esc(bestPerson().name)}, que suele hacerte bien.` : 'Busca a alguien que te haga bien.'}` });
    else if (avg >= 4) A.push({ id: 'mood-good-' + iso(), lvl: 'good', c: '#34c759', icon: '✨', title: '¡Buena semana!',
      body: `Tu ánimo promedio es ${avg.toFixed(1)} de 5. Fíjate qué estás haciendo diferente y sigue así.` });
  }
  // Personas
  db.people.forEach(p => {
    const s = statsOf(p.id, 60);
    if (s.neg >= 3 && s.neg > s.pos && !activePause(p.id)) A.push({ id: 'bal-' + p.id + s.neg, lvl: 'danger', c: '#ff375f', icon: '⚖️', title: `${p.name} te está costando`,
      body: `${s.neg} momentos malos y ${s.pos} buenos en 2 meses. Mira el consejo para esta persona.`, acts: [['Ver consejo', 'advice', p.id]] });
    if (p.trust >= 4 && statsOf(p.id, 90).betrayals > 0) A.push({ id: 'trust-mis-' + p.id, lvl: 'warn', c: '#ff3b30', icon: '🗡️', title: `Revisa tu confianza en ${p.name}`,
      body: 'Rompió tu confianza hace poco y aún la tienes en un nivel alto.', acts: [['Ajustar', 'trust', p.id]] });
    const g = statsOf(p.id, 30).gossip;
    if (g >= 2) A.push({ id: 'gos-p-' + p.id + g, lvl: 'info', c: '#ff9f0a', icon: '👂', title: `${p.name} te cuenta muchos chismes`,
      body: `${g} este mes. Quien te cuenta de otros, también puede contar de ti. Cuida lo que le confías.` });
    const s90 = statsOf(p.id, 120);
    if (s90.pos >= 3 && s90.neg === 0 && s90.lastAny && daysAgo(s90.lastAny) >= 30) A.push({ id: 'miss-' + p.id + s90.lastAny, lvl: 'good', c: '#34c759', icon: '💌', title: `Busca a ${p.name}`,
      body: `Te hace bien y no registras nada con esa persona desde hace ${daysAgo(s90.lastAny)} días.` });
    if (p.birthday) {
      const [, m, d] = p.birthday.split('-').map(Number);
      const now = new Date(); let b = new Date(now.getFullYear(), m - 1, d);
      if (iso(b) < iso(now)) b = new Date(now.getFullYear() + 1, m - 1, d);
      const n = daysBetween(iso(now), iso(b));
      if (n <= 7) A.push({ id: 'bday-' + p.id + iso(b), lvl: 'good', c: '#bf5af2', icon: '🎂', title: n === 0 ? `¡Hoy cumple ${p.name}!` : `${p.name} cumple en ${n} ${plural(n, 'día', 'días')}`, body: p.likes ? `Le gusta: ${esc(p.likes)}` : 'No se te olvide felicitarle.' });
    }
  });
  // Promesas rotas
  const broken = db.entries.filter(e => e.type === 'promesa' && e.promiseBy === 'yo' && e.promiseStatus === 'pendiente' && daysAgo(e.date) >= 7);
  broken.forEach(e => A.push({ id: 'prom-' + e.id, lvl: 'info', c: '#a2845e', icon: '🤝', title: 'Tienes una promesa pendiente',
    body: `“${esc((e.text || '').slice(0, 70))}” desde hace ${daysAgo(e.date)} días.`, acts: [['Ya la cumplí', 'keepPromise', e.id]] }));

  const order = { danger: 0, warn: 1, info: 2, good: 3 };
  return A.filter(a => !db.dismissed[a.id]).sort((a, b) => order[a.lvl] - order[b.lvl]);
}
function bestPerson() {
  let best = null, bs = 0;
  db.people.forEach(p => { const s = statsOf(p.id, 90); const sc = s.pos - s.neg * 2; if (sc > bs && !activePause(p.id)) { bs = sc; best = p; } });
  return best;
}

// ---------- Estado de la interfaz ----------
const state = { tab: 'hoy', q: '', pq: '' };
const TITLES = { hoy: 'Hoy', personas: 'Personas', consejos: 'Consejos', yo: 'Yo' };

function render() {
  const v = $('#view');
  v.innerHTML = { hoy: viewHoy, personas: viewPersonas, consejos: viewConsejos, yo: viewYo }[state.tab]();
  $$('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === state.tab));
  $('#topbar-title').textContent = TITLES[state.tab];
  onScroll();
  if (state.tab === 'hoy') bindSearch('#q', 'q', () => { $('#entry-list').innerHTML = entryList(); });
  if (state.tab === 'personas') bindSearch('#pq', 'pq', () => { $('#people-list').innerHTML = peopleList(); });
}
function bindSearch(sel, key, fn) { const i = $(sel); if (!i) return; i.value = state[key]; i.addEventListener('input', () => { state[key] = i.value; fn(); }); }
function onScroll() { $('#topbar').classList.toggle('show', scrollY > 46); }
addEventListener('scroll', onScroll, { passive: true });

// ---------- Vista: Hoy ----------
function viewHoy() {
  const today = db.moods.find(m => m.date === iso());
  const hi = db.settings.name ? `Hola, ${esc(db.settings.name)}` : 'Hola';
  const alerts = computeAlerts();
  const pauses = db.pauses.filter(p => !p.ended && daysAgo(p.start) < p.days);
  let h = `<header class="large"><div><p class="eyebrow">${fmtLong(iso())}</p><h1>${hi}</h1></div>
    <button class="round-btn" data-act="newPerson" aria-label="Agregar persona"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></header>`;

  if (today) {
    const m = MOODS[today.mood - 1];
    h += `<section class="hero" data-act="mood" role="button">
      <p style="margin:0">Hoy te sientes</p>
      <div class="today"><span class="big">${m.e}</span><div><h3>${m.label}</h3><p>Toca para cambiar</p></div></div>
      ${today.emotions?.length ? `<div class="chips">${today.emotions.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</section>`;
  } else {
    h += `<section class="hero"><h3>¿Cómo te sientes hoy?</h3><p>Tómate un segundo para ti.</p>
      <div class="mood-faces">${MOODS.map(m => `<button data-act="mood" data-v="${m.v}" aria-label="${m.label}">${m.e}</button>`).join('')}</div></section>`;
  }

  if (alerts.length) {
    h += `<div class="section-title"><h2>Para ti</h2>${alerts.length > 2 ? `<button class="link" data-act="tab" data-tab="consejos">Ver ${alerts.length}</button>` : ''}</div>`;
    h += alerts.slice(0, 2).map(alertCard).join('');
  }

  if (pauses.length) {
    h += `<div class="section-title"><h2>Pausas activas</h2></div><div class="pauses">${pauses.map(pauseCard).join('')}</div>`;
  }

  h += `<div class="section-title"><h2>Registrar</h2></div><div class="quick">
    ${['conversacion', 'confie', 'bien', 'mal'].map(t => `<button data-act="entryForm" data-type="${t}"><span class="icon-sq" style="--c:${TYPES[t].color}">${TYPES[t].emoji}</span>${TYPES[t].short}</button>`).join('')}</div>`;

  h += `<div class="section-title"><h2>Tu historia</h2></div>
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="q" type="search" placeholder="Buscar: “a quién le conté…”" autocomplete="off"></label>
    <div id="entry-list">${entryList()}</div>`;
  return h;
}
function entryList() {
  const q = state.q.trim().toLowerCase();
  let list = [...db.entries].sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
  if (q) list = list.filter(e => [e.text, e.about, TYPES[e.type].label, ...(e.people || []).map(id => person(id)?.name)].join(' ').toLowerCase().includes(q));
  if (!db.entries.length) return `<div class="empty"><div class="big">📖</div><h3>Tu historia empieza aquí</h3><p>Registra una conversación, algo que confiaste o cómo te hizo sentir alguien.</p><button class="btn solid" data-act="newEntry">Nuevo registro</button></div>`;
  if (!list.length) return `<div class="empty"><div class="big">🔍</div><p>No encontré nada con “${esc(state.q)}”.</p></div>`;
  const groups = {};
  list.slice(0, q ? 200 : 60).forEach(e => (groups[e.date] ||= []).push(e));
  return Object.entries(groups).map(([d, es]) => `<p class="group-label">${fmtDate(d)}</p><div class="list" style="--inset:60px">${es.map(entryRow).join('')}</div>`).join('');
}
function entryRow(e, inPerson) {
  const t = TYPES[e.type];
  const names = inPerson ? t.label + ' · ' + fmtDate(e.date) : (e.people || []).map(id => person(id)?.name).filter(Boolean).join(', ');
  const feel = FEEL.find(f => f.v === e.feel);
  return `<button class="row" data-act="entry" data-id="${e.id}"><span class="icon-sq" style="--c:${t.color}">${t.emoji}</span>
    <div class="grow"><div class="title">${esc(names || t.label)}</div><div class="sub">${esc(e.text || t.label)}</div></div>
    ${feel ? `<span class="meta">${feel.e}</span>` : ''}${CHEV}</button>`;
}
function alertCard(a) {
  return `<div class="alert" style="--c:${a.c}"><span class="ic">${a.icon}</span><div class="body"><h4>${esc(a.title)}</h4><p>${a.body}</p>
    ${a.acts ? `<div class="acts">${a.acts.map(([l, act, arg]) => `<button class="btn" data-act="${act}" data-id="${arg}">${l}</button>`).join('')}</div>` : ''}</div>
    <button class="x" data-act="dismiss" data-id="${a.id}" aria-label="Descartar">✕</button></div>`;
}
function pauseCard(pz) {
  const p = person(pz.personId); if (!p) return '';
  const left = pauseLeft(pz), frac = clamp(1 - left / pz.days, 0, 1), C = 2 * Math.PI * 32;
  return `<button class="pause-card" data-act="person" data-id="${p.id}"><div class="ringwrap"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="32" fill="none" stroke="var(--fill)" stroke-width="5"/>
    <circle cx="36" cy="36" r="32" fill="none" stroke="url(#g${pz.id})" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/>
    <defs><linearGradient id="g${pz.id}"><stop offset="0" stop-color="#6a5cff"/><stop offset="1" stop-color="#ff5fa2"/></linearGradient></defs></svg>${avatar(p, 52)}</div>
    <b>${esc(p.name)}</b><small>${left} ${plural(left, 'día restante', 'días restantes')}</small></button>`;
}

// ---------- Vista: Personas ----------
function viewPersonas() {
  return `<header class="large"><div><h1>Personas</h1></div>
    <button class="round-btn" data-act="newPerson" aria-label="Agregar persona"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></header>
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="pq" type="search" placeholder="Buscar" autocomplete="off"></label>
    <div id="people-list">${peopleList()}</div>`;
}
function peopleList() {
  if (!db.people.length) return `<div class="empty"><div class="big">👥</div><h3>Agrega a tu gente</h3><p>Amigos, familia, pareja, compañeros… Cada uno tendrá su historia y su nivel de confianza.</p><button class="btn solid" data-act="newPerson">Agregar persona</button></div>`;
  const q = state.pq.trim().toLowerCase();
  const list = db.people.filter(p => !q || p.name.toLowerCase().includes(q));
  const groups = [
    ['Confío', '💚', list.filter(p => p.trust >= 4)],
    ['Con cuidado', '🟡', list.filter(p => p.trust === 3)],
    ['No confiar', '🔴', list.filter(p => p.trust <= 2)],
  ];
  return groups.filter(g => g[2].length).map(([name, ic, ps]) => `<p class="group-label">${ic} ${name} · ${ps.length}</p>
    <div class="list" style="--inset:72px">${ps.sort((a, b) => a.name.localeCompare(b.name)).map(personRow).join('')}</div>`).join('') || `<div class="empty"><p>Nadie coincide.</p></div>`;
}
function personRow(p) {
  const s = statsOf(p.id, 90); const pz = activePause(p.id);
  const sub = pz ? `⏸️ En pausa · ${pauseLeft(pz)} ${plural(pauseLeft(pz), 'día', 'días')}` : `${p.relation || 'Persona'} · 💚 ${s.pos}  💔 ${s.neg}`;
  return `<button class="row" data-act="person" data-id="${p.id}">${avatar(p, 44, true)}<div class="grow"><div class="title">${esc(p.name)}</div><div class="sub">${sub}</div></div>
    <span class="pill" style="--c:${TRUST[p.trust].c}">${TRUST[p.trust].label}</span>${CHEV}</button>`;
}

// ---------- Vista: Consejos ----------
function viewConsejos() {
  const alerts = computeAlerts();
  let h = `<header class="large"><div><h1>Consejos</h1></div></header>`;
  h += `<div class="section-title" style="margin-top:8px"><h2>Alertas</h2></div>`;
  h += alerts.length ? alerts.map(alertCard).join('') : `<div class="card empty" style="padding:24px"><div class="big">🌿</div><p style="margin:0">Todo tranquilo por ahora. Entre más registres, mejores consejos te daré.</p></div>`;
  h += `<div class="section-title"><h2>Cómo poner límites</h2></div>
    <div class="list"><ul class="bullets">${LIMIT_TIPS.map(([i, t]) => `<li data-i="${i}">${t}</li>`).join('')}</ul></div>
    <p class="group-label">Según la situación</p>
    ${Object.entries(LIMITS).map(([k, l]) => guideBlock(k, l)).join('')}`;
  h += `<div class="section-title"><h2>Cómo alejarte sanamente</h2></div>
    ${LEVELS.map((L, i) => `<details class="guide"><summary><span class="icon-sq" style="--c:${['#5ac8fa', '#ff9f0a', '#ff375f', '#8e2de2'][i]}">${L.emoji}</span>${L.name}<small style="color:var(--label2);font-weight:400">${['1–2 días', '3–7 días', '8–21 días', '+3 semanas'][i]}</small>${CHEV}</summary>
      <div class="inner">${L.todo.map(([e, t]) => `<p>${e} ${t}</p>`).join('')}</div></details>`).join('')}
    <p class="footnote">Alejarte no siempre significa terminar una relación: es darte espacio para pensar con claridad. Estas recomendaciones son una guía; tú conoces tu vida mejor que nadie.</p>`;
  return h;
}
function guideBlock(k, l) {
  return `<details class="guide" id="lim-${k}"><summary><span class="icon-sq" style="--c:var(--fill)">${l.emoji}</span>${l.title}${CHEV}</summary>
    <div class="inner"><p style="color:var(--label2)">${l.intro}</p><h5>Puedes decir</h5>${l.say.map(s => `<div class="q">“${s}”</div>`).join('')}
    <h5>Cómo sostenerlo</h5><p>${l.hold}</p></div></details>`;
}

// ---------- Vista: Yo ----------
function viewYo() {
  const last30 = db.entries.filter(e => daysAgo(e.date) <= 30);
  const moods = db.moods.filter(m => daysAgo(m.date) <= 29);
  const avg = moods.length ? (moods.reduce((a, m) => a + m.mood, 0) / moods.length) : null;
  let h = `<header class="large"><div><h1>Yo</h1></div></header>`;
  h += `<div class="stats" style="margin-top:4px">
    <div class="stat"><b>${avg ? MOODS[Math.round(avg) - 1].e : '—'}</b><span>Ánimo (30 d)</span></div>
    <div class="stat"><b>${last30.length}</b><span>Registros (30 d)</span></div>
    <div class="stat"><b>${db.people.length}</b><span>Personas</span></div></div>`;

  // Gráfica de ánimo
  h += `<div class="section-title"><h2>Tu ánimo</h2></div><div class="chart">${moodChart()}<div class="legend"><span>Hace 30 días</span><span>Hoy</span></div></div>`;

  // Emociones frecuentes
  const em = {}; moods.forEach(m => (m.emotions || []).forEach(x => em[x] = (em[x] || 0) + 1));
  const emSorted = Object.entries(em).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (emSorted.length) {
    const max = emSorted[0][1];
    h += `<div class="section-title"><h2>Lo que más sientes</h2></div><div class="card" style="padding:16px"><div class="bars">
      ${emSorted.map(([k, n]) => `<div class="bar-row"><span>${esc(k)}</span><div class="track"><i style="width:${n / max * 100}%;--c:${['Ansioso', 'Estresado', 'Triste', 'Solo', 'Enojado', 'Celoso', 'Cansado', 'Confundido', 'Inseguro'].includes(k) ? '#ff9f0a' : '#34c759'}"></i></div><b>${n}</b></div>`).join('')}</div></div>`;
  }

  // Mejorar mi vida
  const tips = lifeTips(emSorted, last30);
  h += `<div class="section-title"><h2>Para mejorar</h2></div>`;
  h += tips.length ? `<div class="list"><ul class="bullets">${tips.map(([i, t]) => `<li data-i="${i}">${t}</li>`).join('')}</ul></div>`
    : `<div class="card" style="padding:16px;color:var(--label2);font-size:15px">Registra tu ánimo unos días y aquí verás sugerencias personalizadas.</div>`;

  // Quién te hace bien / mal
  const ranked = db.people.map(p => ({ p, s: statsOf(p.id, 90) })).filter(x => x.s.total);
  const good = ranked.filter(x => x.s.pos > x.s.neg).sort((a, b) => (b.s.pos - b.s.neg) - (a.s.pos - a.s.neg)).slice(0, 3);
  const bad = ranked.filter(x => x.s.neg > x.s.pos).sort((a, b) => (b.s.neg - b.s.pos) - (a.s.neg - a.s.pos)).slice(0, 3);
  if (good.length || bad.length) {
    h += `<div class="section-title"><h2>Tu círculo (3 meses)</h2></div><div class="list" style="--inset:72px">
      ${good.map(x => `<button class="row" data-act="person" data-id="${x.p.id}">${avatar(x.p, 40)}<div class="grow"><div class="title">${esc(x.p.name)}</div><div class="sub">Te hace bien · 💚 ${x.s.pos}</div></div>${CHEV}</button>`).join('')}
      ${bad.map(x => `<button class="row" data-act="person" data-id="${x.p.id}">${avatar(x.p, 40)}<div class="grow"><div class="title">${esc(x.p.name)}</div><div class="sub">Te hace sentir mal · 💔 ${x.s.neg}</div></div>${CHEV}</button>`).join('')}</div>`;
  }

  // Ajustes
  h += `<div class="section-title"><h2>Ajustes</h2></div><div class="list" style="--inset:60px">
    <button class="row" data-act="setName"><span class="icon-sq" style="--c:#0a84ff">👤</span><div class="grow"><div class="title">Tu nombre</div></div><span class="meta">${esc(db.settings.name || 'Sin nombre')}</span>${CHEV}</button>
    <button class="row" data-act="setPin"><span class="icon-sq" style="--c:#34c759">🔒</span><div class="grow"><div class="title">Código de bloqueo</div></div><span class="meta">${db.settings.pinHash ? 'Activado' : 'Desactivado'}</span>${CHEV}</button>
    <button class="row" data-act="exportData"><span class="icon-sq" style="--c:#5e5ce6">📤</span><div class="grow"><div class="title">Guardar respaldo</div></div>${CHEV}</button>
    <button class="row" data-act="importData"><span class="icon-sq" style="--c:#ff9f0a">📥</span><div class="grow"><div class="title">Restaurar respaldo</div></div>${CHEV}</button>
    <button class="row" data-act="wipe"><span class="icon-sq" style="--c:#ff3b30">🗑️</span><div class="grow"><div class="title" style="color:var(--red)">Borrar todo</div></div></button></div>
    <p class="footnote">🔐 Todo se guarda solo en este iPhone. Nadie más puede verlo: ni siquiera se sube a internet. Guarda un respaldo de vez en cuando por si cambias de teléfono.</p>`;
  return h;
}
function moodChart() {
  const pts = [];
  for (let i = 29; i >= 0; i--) { const d = addDays(iso(), -i); const m = db.moods.find(x => x.date === d); pts.push(m ? m.mood : null); }
  const W = 300, H = 110, bw = W / 30;
  if (!pts.some(Boolean)) return `<div style="text-align:center;color:var(--label2);padding:30px 0;font-size:15px">Aún no registras tu ánimo.</div>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${pts.map((v, i) => v ? `<rect x="${i * bw + 1.5}" y="${H - v / 5 * H}" width="${bw - 3}" height="${v / 5 * H}" rx="3" fill="${MOODS[v - 1].c}"/>` : `<rect x="${i * bw + 1.5}" y="${H - 4}" width="${bw - 3}" height="4" rx="2" fill="var(--fill)"/>`).join('')}</svg>`;
}
function lifeTips(emSorted, last30) {
  const T = []; const top = emSorted.map(x => x[0]);
  const map = {
    Ansioso: ['🫁', 'La ansiedad aparece seguido. Prueba respirar 4 segundos, sostener 4 y soltar 6, tres veces.'],
    Estresado: ['🗂️', 'Mucho estrés. Escribe las 3 cosas más importantes del día y suelta lo demás.'],
    Triste: ['🫂', 'Te has sentido triste. Busca a alguien que te haga bien y no te aísles.'],
    Solo: ['📞', 'Te has sentido solo. Escríbele hoy a alguien de tu círculo de confianza.'],
    Enojado: ['⏱️', 'El enojo es frecuente. Regla de 10 minutos: no respondas nada hasta que pasen.'],
    Celoso: ['🪞', 'Los celos aparecen seguido. Pregúntate qué inseguridad hay detrás.'],
    Cansado: ['😴', 'Mucho cansancio. Dormir bien cambia cómo reaccionas con los demás.'],
    Inseguro: ['💪', 'Inseguridad frecuente. Anota cada noche una cosa que hiciste bien.'],
    Confundido: ['📝', 'Te has sentido confundido. Escribir lo que pasó ayuda a ordenar ideas.'],
  };
  top.forEach(k => map[k] && T.push(map[k]));
  const secrets = last30.filter(e => e.type === 'confie' || e.type === 'confese').length;
  if (secrets >= 6) T.push(['🤐', `Contaste ${secrets} cosas personales este mes. Guarda algunas solo para ti o para tu círculo más cercano.`]);
  const anger = last30.filter(e => e.type === 'enojo').length;
  if (anger >= 4) T.push(['🌋', `Te enojaste ${anger} veces este mes. Revisa qué tienen en común esas situaciones.`]);
  const outs = last30.filter(e => e.type === 'salida').length;
  if (outs === 0 && db.entries.length > 5) T.push(['🌳', 'No registras salidas este mes. Planea algo con alguien que te haga bien.']);
  const bp = bestPerson(); if (bp) T.push(['💚', `${bp.name} es de las personas que más te hacen bien. Pasa más tiempo con esa persona.`]);
  return T.slice(0, 6);
}

// ---------- Hojas (sheets) con física de resorte ----------
function spring(from, to, v0, onUpdate, onDone, { response = 0.38, damping = 1 } = {}) {
  const w = (2 * Math.PI) / response; let x = from - to, v = v0, last = performance.now(), raf;
  const step = now => {
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    for (let i = 0; i < 4; i++) { const h = dt / 4; const a = -w * w * x - 2 * damping * w * v; v += a * h; x += v * h; }
    onUpdate(to + x);
    if (Math.abs(x) < 0.4 && Math.abs(v) < 8) { onUpdate(to); onDone && onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
const sheets = [];
function openSheet(o) {
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="scrim"></div><section class="sheet${o.short ? ' short' : ''}" role="dialog" aria-modal="true"><div class="sheet-head"><div class="grabber"></div><div class="sheet-nav"></div></div><div class="sheet-body"></div></section>`;
  $('#sheets').appendChild(wrap);
  const el = $('.sheet', wrap), scrim = $('.scrim', wrap), app = $('#app');
  const s = { wrap, el, y: 0, h: 0, stop: null, onClose: o.onClose };
  const first = sheets.length === 0;
  sheets.push(s);
  s.set = y => {
    s.y = y; const p = clamp(1 - y / (s.h || 1), 0, 1);
    el.style.transform = `translateY(${y}px)`; scrim.style.opacity = p;
    if (first && !reduceMotion.matches) { app.style.transform = `scale(${1 - 0.06 * p})`; app.style.borderRadius = `${12 * p}px`; app.style.overflow = 'hidden'; }
  };
  s.fill = o2 => {
    $('.sheet-nav', wrap).innerHTML = `<button class="nav-btn" data-close>${o2.left || 'Cerrar'}</button><h2>${esc(o2.title || '')}</h2>${o2.right ? `<button class="nav-btn right" data-sheet-right>${o2.right}</button>` : '<span></span>'}`;
    $('.sheet-body', wrap).innerHTML = o2.body; $('.sheet-body', wrap).scrollTop = 0;
    $('[data-close]', wrap).onclick = () => s.close();
    if (o2.right) $('[data-sheet-right]', wrap).onclick = () => o2.onRight(s);
    o2.mount && o2.mount(s, $('.sheet-body', wrap));
  };
  s.close = (v = 0) => {
    s.stop && s.stop(); s.h = el.getBoundingClientRect().height + 20; const done = () => { wrap.remove(); sheets.splice(sheets.indexOf(s), 1); if (first) { app.style.transform = ''; app.style.borderRadius = ''; app.style.overflow = ''; } s.onClose && s.onClose(); };
    if (reduceMotion.matches) { wrap.style.transition = 'opacity .2s'; wrap.style.opacity = 0; setTimeout(done, 200); return; }
    s.stop = spring(s.y, s.h, v, s.set, done, { response: 0.32 });
  };
  s.fill(o);
  requestAnimationFrame(() => {
    s.h = el.getBoundingClientRect().height + 20; s.set(s.h);
    if (reduceMotion.matches) { s.set(0); return; }
    s.stop = spring(s.h, 0, 0, s.set, null, { response: 0.4 });
  });
  scrim.onclick = () => s.close();

  // Arrastrar para cerrar (desde la cabecera)
  const head = $('.sheet-head', wrap); let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    s.stop && s.stop(); head.setPointerCapture(e.pointerId);
    drag = { y0: e.clientY - s.y, hist: [[e.clientY, e.timeStamp]] };
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return; let y = e.clientY - drag.y0;
    if (y < 0) y = -(Math.abs(y) * 60) / (60 + Math.abs(y)); // resistencia elástica
    s.set(y); drag.hist.push([e.clientY, e.timeStamp]); if (drag.hist.length > 5) drag.hist.shift();
  });
  const end = () => {
    if (!drag) return; const H = drag.hist; drag = null; s.h = el.getBoundingClientRect().height + 20;
    const [a, b] = [H[0], H[H.length - 1]]; const v = b[1] > a[1] ? (b[0] - a[0]) / ((b[1] - a[1]) / 1000) : 0;
    if (s.y + project(v) > s.h * 0.4) s.close(v);
    else s.stop = spring(s.y, 0, v, s.set, null, { response: 0.3, damping: 0.85 });
  };
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  return s;
}
const topSheet = () => sheets[sheets.length - 1];
function closeAll() { [...sheets].reverse().forEach(s => s.close()); }

// ---------- Formularios: piezas ----------
function seg(field, opts, val) { return `<div class="seg" data-seg="${field}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`; }
function sw(field, label, checked) { return `<label class="switch-row"><span>${label}</span><span class="switch"><input type="checkbox" data-sw="${field}" ${checked ? 'checked' : ''}><span></span></span></label>`; }
function wireSegs(root) {
  $$('.seg', root).forEach(sg => sg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); }));
  $$('.feel', root).forEach(f => f.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', f).forEach(x => x.classList.toggle('on', x === b)); }));
}
const segVal = (root, f) => $(`[data-seg="${f}"] .on`, root)?.dataset.v;
const swVal = (root, f) => !!$(`[data-sw="${f}"]`, root)?.checked;

function peoplePicker(selected = []) {
  const sorted = [...db.people].sort((a, b) => (statsOf(b.id).lastAny || '').localeCompare(statsOf(a.id).lastAny || ''));
  return `<div class="chips" id="pp">${sorted.map(p => `<button type="button" class="chip${selected.includes(p.id) ? ' on' : ''}" data-pid="${p.id}">${avatar(p, 28)}${esc(p.name)}</button>`).join('')}
    <button type="button" class="chip add" id="pp-add">＋ Nueva</button></div>
    <div id="pp-new" hidden style="margin-top:10px;display:flex;gap:8px"><input class="plain-input" id="pp-name" placeholder="Nombre" style="flex:1"><button type="button" class="btn solid" id="pp-ok" style="height:auto">Agregar</button></div>`;
}
function wirePicker(root) {
  const box = $('#pp', root);
  box.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-pid]'); if (c) { c.classList.toggle('on'); return; }
    if (e.target.closest('#pp-add')) { const n = $('#pp-new', root); n.hidden = false; n.style.display = 'flex'; $('#pp-name', root).focus(); }
  });
  const add = () => {
    const name = $('#pp-name', root).value.trim(); if (!name) return;
    const p = newPerson({ name }); const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'chip on'; chip.dataset.pid = p.id; chip.innerHTML = avatar(p, 28) + esc(p.name);
    box.insertBefore(chip, $('#pp-add', root)); $('#pp-name', root).value = ''; $('#pp-new', root).hidden = true;
  };
  $('#pp-ok', root).onclick = add;
  $('#pp-name', root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
}
const pickedPeople = root => $$('#pp .chip.on', root).map(c => c.dataset.pid);
function newPerson(d) {
  const p = { id: uid(), name: d.name, emoji: d.emoji || '', relation: d.relation || 'Amigo/a', trust: d.trust || 3, birthday: d.birthday || '', likes: d.likes || '', notes: d.notes || '', trustHistory: [], created: Date.now() };
  db.people.push(p); save(); return p;
}

// ---------- Hoja: nuevo registro ----------
function sheetPickType(presetPerson) {
  openSheet({ title: 'Nuevo registro', short: true, body: `<p class="footnote" style="margin:0 4px 12px">¿Qué pasó?</p><div class="type-grid">
    ${Object.entries(TYPES).map(([k, t]) => `<button data-pick="${k}"><span class="icon-sq" style="--c:${t.color}">${t.emoji}</span>${t.label}</button>`).join('')}</div>
    <button class="btn-lg plain" data-pick-mood style="margin-top:14px">🌈 Registrar cómo me siento</button>`,
    mount: (s, b) => {
      b.addEventListener('click', e => {
        const k = e.target.closest('[data-pick]')?.dataset.pick;
        if (k) { s.fill(entryFormOpts(k, null, presetPerson)); return; }
        if (e.target.closest('[data-pick-mood]')) { s.close(); sheetMood(); }
      });
    } });
}
function entryFormOpts(type, entry, presetPerson) {
  const t = TYPES[type]; const e = entry || {};
  const sel = e.people || (presetPerson ? [presetPerson] : []);
  const feelDefault = e.feel ?? (NEG.includes(type) ? -1 : ['bien', 'salida'].includes(type) ? 1 : type === 'enojo' || type === 'mepase' ? -1 : 0);
  let extra = '';
  if (NEG.includes(type)) extra = `<p class="group-label">¿Qué tan fuerte fue?</p>${seg('severity', SEV.map((l, i) => [i + 1, l]), e.severity || 3)}
    <p class="group-label">Siendo honesto</p><div class="fields">${sw('myPart', 'Yo también tuve parte', e.myPart)}</div>`;
  if (type === 'confie' || type === 'confese') extra = `<p class="group-label">Detalles</p><div class="fields">${sw('delicate', 'Es algo delicado o secreto', e.delicate ?? true)}</div>`;
  if (type === 'chisme') extra = `<p class="group-label">¿Sobre quién era?</p><input class="plain-input" data-f="about" value="${esc(e.about)}" placeholder="Nombre de la persona">
    <p class="group-label">Siendo honesto</p><div class="fields">${sw('repeated', 'Yo se lo conté a alguien más', e.repeated)}</div>`;
  if (type === 'enojo') extra = `<p class="group-label">¿Qué tan enojado?</p>${seg('severity', SEV.map((l, i) => [i + 1, l]), e.severity || 3)}
    <p class="group-label">Estado</p><div class="fields">${sw('resolved', 'Ya se resolvió', e.resolved)}</div>`;
  if (type === 'mepase') extra = `<p class="group-label">¿Qué tanto?</p>${seg('severity', SEV.map((l, i) => [i + 1, l]), e.severity || 2)}
    <p class="group-label">Estado</p><div class="fields">${sw('repaired', 'Ya pedí perdón o lo reparé', e.repaired)}</div>`;
  if (type === 'promesa') extra = `<p class="group-label">¿Quién prometió?</p>${seg('promiseBy', [['yo', 'Yo prometí'], ['otro', 'Me prometieron']], e.promiseBy || 'otro')}
    <p class="group-label">¿Se cumplió?</p>${seg('promiseStatus', [['pendiente', 'Pendiente'], ['cumplida', 'Cumplida'], ['rota', 'Rota']], e.promiseStatus || 'pendiente')}`;

  const whoLabel = { enojo: '¿Con quién? (opcional)', mepase: '¿Con quién? (opcional)', chisme: '¿Quién te lo contó?' }[type] || '¿Con quién?';
  return {
    title: t.short, left: 'Cancelar', right: 'Guardar',
    body: `<div style="display:flex;align-items:center;gap:12px;margin:2px 4px 4px"><span class="icon-sq lg" style="--c:${t.color}">${t.emoji}</span><div style="font-size:15px;color:var(--label2)">${t.ask}</div></div>
      <p class="group-label">${whoLabel}</p>${peoplePicker(sel)}
      <p class="group-label">¿Qué pasó?</p><textarea class="note" data-f="text" placeholder="Escribe con tus palabras…">${esc(e.text)}</textarea>
      ${extra}
      <p class="group-label">¿Cómo te sentiste?</p><div class="feel">${FEEL.map(f => `<button type="button" data-v="${f.v}" class="${f.v === feelDefault ? 'on' : ''}">${f.e}</button>`).join('')}</div>
      <p class="group-label">Fecha</p><div class="fields"><div class="field"><label>Día</label><input type="date" data-f="date" value="${e.date || iso()}" max="${iso()}"></div></div>
      ${entry ? `<button class="btn-lg danger" data-del style="margin-top:28px">Eliminar registro</button>` : ''}`,
    mount: (s, b) => {
      wireSegs(b); wirePicker(b);
      if (!entry) setTimeout(() => $('[data-f="text"]', b)?.focus({ preventScroll: true }), 450);
      $('[data-del]', b)?.addEventListener('click', () => {
        if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
        db.entries = db.entries.filter(x => x.id !== entry.id); db.pauses = db.pauses.filter(p => p.entryId !== entry.id); save(); s.close(); render(); refreshOpenPerson(); toast('Registro eliminado');
      });
    },
    onRight: s => {
      const b = $('.sheet-body', s.wrap);
      const people = pickedPeople(b);
      const text = $('[data-f="text"]', b).value.trim();
      const needsPerson = !['enojo', 'mepase'].includes(type);
      if (needsPerson && !people.length) { toast('Elige con quién fue'); return; }
      if (!text && !people.length) { toast('Escribe qué pasó'); return; }
      const rec = Object.assign(entry || { id: uid(), created: Date.now() }, {
        type, people, text, date: $('[data-f="date"]', b).value || iso(),
        feel: Number($('.feel .on', b)?.dataset.v ?? 0),
      });
      if (segVal(b, 'severity')) rec.severity = Number(segVal(b, 'severity'));
      ['myPart', 'delicate', 'repeated', 'resolved', 'repaired'].forEach(f => { if ($(`[data-sw="${f}"]`, b)) rec[f] = swVal(b, f); });
      if ($('[data-f="about"]', b)) rec.about = $('[data-f="about"]', b).value.trim();
      if (segVal(b, 'promiseBy')) { rec.promiseBy = segVal(b, 'promiseBy'); rec.promiseStatus = segVal(b, 'promiseStatus'); }
      if (!entry) db.entries.push(rec);
      save(); render(); refreshOpenPerson();
      const fb = feedbackFor(rec, !entry);
      if (fb) s.fill(fb); else { s.close(); toast('✓ Guardado'); }
    },
  };
}

// Retroalimentación justo después de guardar
function feedbackFor(e, isNew) {
  if (!isNew) return null;
  const parts = [];
  const recs = recommendFor(e);
  recs.forEach(r => {
    const L = LEVELS[r.level]; const until = addDays(e.date, r.days);
    parts.push(`<div class="rec-hero l${r.level}"><div class="who">${avatar(r.p, 36)}${esc(r.p.name)}</div>
      <div class="days">${r.days}<small>${plural(r.days, 'día', 'días')}</small></div>
      <div class="lvl">${L.emoji} Te recomiendo: ${L.name.toLowerCase()}</div><div class="until">Hasta el ${fmtLong(until).toLowerCase()}</div></div>
      <p class="group-label">Por qué</p><div class="list"><ul class="bullets">${r.why.map(([i, t]) => `<li data-i="${i}">${t}</li>`).join('')}</ul></div>
      ${r.pattern ? `<div class="alert" style="--c:#ff375f;margin-top:12px"><span class="ic">🔁</span><div class="body"><h4>Esto ya es un patrón</h4><p>Con ${esc(r.p.name)} hay más momentos malos que buenos. Piensa si quieres hablarlo en serio o alejarte por más tiempo.</p></div></div>` : ''}
      <p class="group-label">Qué hacer estos días</p><div class="list"><ul class="bullets">${L.todo.map(([i, t]) => `<li data-i="${i}">${t}</li>`).join('')}</ul></div>
      <p class="group-label">Si quieres poner un límite, puedes decir</p>${LIMITS[r.limitKey].say.slice(0, 2).map(t => `<div class="script">${t}</div>`).join('')}
      <div class="stack" style="margin-top:16px">
        ${activePause(r.p.id) ? '' : `<button class="btn-lg grad" data-act="startPause" data-id="${r.p.id}" data-days="${r.days}" data-entry="${e.id}">⏸️ Iniciar pausa de ${r.days} ${plural(r.days, 'día', 'días')}</button>`}
        ${r.trustTo ? `<button class="btn-lg plain" data-act="setTrust" data-id="${r.p.id}" data-v="${r.trustTo}" data-reason="${esc(TYPES[e.type].label)}">Bajar confianza a “${TRUST[r.trustTo].label}”</button>` : ''}
      </div>`);
  });
  if (e.type === 'confie' || e.type === 'confese') {
    const low = e.people.map(person).filter(p => p && p.trust <= 2);
    if (low.length) parts.push(`<div class="alert" style="--c:#ff3b30"><span class="ic">🤐</span><div class="body"><h4>Cuidado con lo que le cuentas</h4><p>Le confiaste algo a ${low.map(p => esc(p.name)).join(' y ')}, y tu nivel de confianza es bajo. Quizá no fue la mejor idea; para la próxima, piénsalo dos veces.</p></div></div>`);
    const wk = db.entries.filter(x => (x.type === 'confie' || x.type === 'confese') && daysAgo(x.date) <= 7).length;
    if (wk >= 3) parts.push(`<div class="alert" style="--c:#5e5ce6"><span class="ic">🫢</span><div class="body"><h4>Estás contando mucho</h4><p>Ya van ${wk} cosas personales esta semana. No todo el mundo necesita saber todo de ti.</p></div></div>`);
  }
  if (e.type === 'chisme' && e.repeated) parts.push(`<div class="alert" style="--c:#ff9f0a"><span class="ic">🫣</span><div class="body"><h4>Lo repetiste</h4><p>Pasa. Pero si alguien hiciera lo mismo con tus cosas, ¿cómo te sentirías? Para la próxima, intenta que se quede contigo.</p></div></div>`);
  if (e.type === 'chisme') {
    const teller = e.people.map(person).filter(Boolean)[0];
    if (teller && statsOf(teller.id, 30).gossip >= 2) parts.push(`<div class="alert" style="--c:#ff9f0a"><span class="ic">👂</span><div class="body"><h4>${esc(teller.name)} cuenta mucho</h4><p>Ya te ha contado ${statsOf(teller.id, 30).gossip} chismes este mes. Quien te cuenta de otros, puede contar de ti.</p></div></div>`);
  }
  if (e.type === 'enojo') parts.push(`<div class="alert" style="--c:#ff6b00"><span class="ic">🌬️</span><div class="body"><h4>Antes de responder</h4><p>Respira profundo 3 veces y espera 10 minutos. Si aún quieres decir algo, que sea sobre cómo te sientes, no sobre cómo es la otra persona.</p></div></div>
    <p class="group-label">Puedes decir</p><div class="script">${LIMITS.yo.say[1]}</div>`);
  if (e.type === 'mepase') parts.push(`<div class="alert" style="--c:#e6b800"><span class="ic">🩹</span><div class="body"><h4>Reconocerlo ya es un gran paso</h4><p>${e.repaired ? 'Qué bien que ya lo reparaste.' : 'Si puedes, repáralo pronto. Una disculpa sincera, sin “pero”, abre puertas.'}</p></div></div>
    ${e.repaired ? '' : `<p class="group-label">Puedes decir</p><div class="script">${LIMITS.yo.say[0]}</div>`}`);
  if (e.type === 'bien') parts.push(`<div class="alert" style="--c:#34c759"><span class="ic">💚</span><div class="body"><h4>Guárdalo y agradécelo</h4><p>Decirle a alguien “me hiciste sentir bien” fortalece mucho la relación.</p></div></div>`);
  e.people?.forEach(pid => { const pz = activePause(pid); if (pz && ['conversacion', 'salida', 'confie', 'confese'].includes(e.type)) parts.push(`<div class="alert" style="--c:#ff9f0a"><span class="ic">🚦</span><div class="body"><h4>Estabas en pausa con ${esc(person(pid).name)}</h4><p>Te faltaban ${pauseLeft(pz)} ${plural(pauseLeft(pz), 'día', 'días')}. ¿Fue tu decisión o costumbre?</p></div></div>`); });
  if (!parts.length) return null;
  return { title: 'Mi consejo', left: 'Listo', body: `<div style="text-align:center;font-size:15px;color:var(--label2);margin:-2px 0 14px">✓ Guardado</div>${parts.join('<div style="height:18px"></div>')}` };
}

// ---------- Hoja: ver registro ----------
function sheetEntry(id) {
  const e = db.entries.find(x => x.id === id); if (!e) return;
  openSheet(entryFormOpts(e.type, e));
}

// ---------- Hoja: ánimo ----------
function sheetMood(v) {
  const today = db.moods.find(m => m.date === iso());
  const cur = v || today?.mood || 3; const sel = today?.emotions || [];
  openSheet({ title: '¿Cómo te sientes?', left: 'Cancelar', right: 'Guardar', short: true,
    body: `<div class="feel" id="mood-pick" style="margin-top:6px">${MOODS.map(m => `<button type="button" data-v="${m.v}" class="${m.v === cur ? 'on' : ''}">${m.e}</button>`).join('')}</div>
      <p id="mood-label" style="text-align:center;font-weight:600;margin:12px 0 0">${MOODS[cur - 1].label}</p>
      <p class="group-label">¿Qué emociones?</p><div class="chips" id="emo">${EMOTIONS.map(x => `<button type="button" class="chip text${sel.includes(x) ? ' on' : ''}">${x}</button>`).join('')}</div>
      <p class="group-label">Nota (opcional)</p><textarea class="note" id="mood-note" placeholder="¿Por qué te sientes así?" style="min-height:80px">${esc(today?.note)}</textarea>`,
    mount: (s, b) => {
      wireSegs(b);
      $('#mood-pick', b).addEventListener('click', ev => { const x = ev.target.closest('button'); if (x) $('#mood-label', b).textContent = MOODS[x.dataset.v - 1].label; });
      $('#emo', b).addEventListener('click', ev => ev.target.closest('.chip')?.classList.toggle('on'));
    },
    onRight: s => {
      const b = $('.sheet-body', s.wrap);
      const m = { date: iso(), mood: Number($('#mood-pick .on', b).dataset.v), emotions: $$('#emo .chip.on', b).map(c => c.textContent), note: $('#mood-note', b).value.trim() };
      db.moods = db.moods.filter(x => x.date !== m.date); db.moods.push(m); save(); s.close(); render();
      toast(m.mood <= 2 ? '🫂 Gracias por contarlo' : '✓ Ánimo guardado');
    } });
}

// ---------- Hoja: persona ----------
let openPersonSheet = null;
function personBody(id) {
  const p = person(id); const s = statsOf(id); const pz = activePause(id);
  const list = entriesOf(id).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
  const secrets = list.filter(e => e.type === 'confie' || e.type === 'confese');
  return `<div class="profile">${avatar(p, 92)}<h3>${esc(p.name)}</h3><p>${esc(p.relation || '')}</p>
      <button data-act="trust" data-id="${p.id}" style="margin-top:4px"><div class="trust-meter" style="--c:${TRUST[p.trust].c}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= p.trust ? 'on' : ''}"></i>`).join('')}</div>
      <p style="margin-top:6px;font-size:14px;font-weight:600;color:${TRUST[p.trust].c}">Confianza: ${TRUST[p.trust].label} · cambiar</p></button></div>
    <div class="stats"><div class="stat"><b>${s.pos}</b><span>💚 Me hizo bien</span></div><div class="stat"><b>${s.neg}</b><span>💔 Me hizo mal</span></div><div class="stat"><b>${s.secrets}</b><span>🤫 Le conté</span></div></div>
    ${pz ? `<div class="alert" style="--c:#5e5ce6;margin-top:14px"><span class="ic">⏸️</span><div class="body"><h4>En pausa: ${pauseLeft(pz)} ${plural(pauseLeft(pz), 'día', 'días')} más</h4><p>Hasta el ${fmtLong(addDays(pz.start, pz.days)).toLowerCase()}.</p><div class="acts"><button class="btn" data-act="endPause" data-id="${pz.id}">Terminar pausa</button></div></div></div>` : ''}
    <div class="stack" style="margin-top:16px">
      <button class="btn-lg grad" data-act="advice" data-id="${p.id}">🧭 ¿Qué hago con ${esc(p.name)}?</button>
      <button class="btn-lg plain" data-act="newEntryFor" data-id="${p.id}">＋ Registrar algo</button></div>
    ${secrets.length ? `<p class="group-label">🤫 Lo que sabe de ti · ${secrets.length}</p><div class="list" style="--inset:60px">${secrets.slice(0, 20).map(e => entryRow(e, true)).join('')}</div>` : ''}
    <p class="group-label">Detalles</p><div class="list" style="--inset:16px">
      ${p.birthday ? `<div class="row"><div class="grow">🎂 Cumpleaños</div><span class="meta">${parseISO(p.birthday).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</span></div>` : ''}
      ${p.likes ? `<div class="row"><div class="grow"><div class="title">❤️ Le gusta</div><div class="sub">${esc(p.likes)}</div></div></div>` : ''}
      ${p.notes ? `<div class="row"><div class="grow"><div class="title">📝 Notas</div><div class="sub" style="-webkit-line-clamp:6">${esc(p.notes)}</div></div></div>` : ''}
      <button class="row" data-act="editPerson" data-id="${p.id}"><div class="grow" style="color:var(--accent)">Editar datos</div>${CHEV}</button></div>
    ${p.trustHistory?.length ? `<p class="group-label">Cambios de confianza</p><div class="list">${[...p.trustHistory].reverse().slice(0, 8).map(t => `<div class="row"><div class="grow"><div class="title">${TRUST[t.from].dot} → ${TRUST[t.to].dot} ${TRUST[t.to].label}</div><div class="sub">${esc(t.reason || 'Sin motivo')}</div></div><span class="meta">${fmtDate(t.date)}</span></div>`).join('')}</div>` : ''}
    <p class="group-label">Historia · ${list.length}</p>
    ${list.length ? `<div class="list" style="--inset:60px">${list.slice(0, 80).map(e => entryRow(e, true)).join('')}</div>` : `<div class="card" style="padding:16px;color:var(--label2);font-size:15px">Aún no hay registros con ${esc(p.name)}.</div>`}`;
}
function sheetPerson(id) {
  const p = person(id); if (!p) return;
  const s = openSheet({ title: p.name, left: 'Cerrar', body: personBody(id), onClose: () => { if (openPersonSheet?.s === s) openPersonSheet = null; } });
  openPersonSheet = { s, id };
}
function refreshOpenPerson() {
  if (!openPersonSheet) return; const { s, id } = openPersonSheet;
  if (!person(id)) { s.close(); return; }
  const b = $('.sheet-body', s.wrap); const y = b.scrollTop; b.innerHTML = personBody(id); b.scrollTop = y;
}

function sheetPersonForm(id) {
  const p = id ? person(id) : {};
  openSheet({ title: id ? 'Editar persona' : 'Nueva persona', left: 'Cancelar', right: id ? 'Guardar' : 'Agregar',
    body: `<div class="fields" style="margin-top:8px">
        <div class="field"><input type="text" class="left" data-f="name" placeholder="Nombre" value="${esc(p.name)}"></div>
        <div class="field"><label>Emoji</label><input type="text" data-f="emoji" placeholder="Opcional" maxlength="4" value="${esc(p.emoji)}"></div>
        <div class="field"><label>Relación</label><select data-f="relation">${RELATIONS.map(r => `<option ${r === (p.relation || 'Amigo/a') ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Cumpleaños</label><input type="date" data-f="birthday" value="${esc(p.birthday)}"></div></div>
      ${id ? '' : `<p class="group-label">¿Cuánto confías en esta persona?</p>${seg('trust', [1, 2, 3, 4, 5].map(i => [i, TRUST[i].dot]), 3)}<p class="footnote" id="trust-lbl">Con cuidado</p>`}
      <p class="group-label">Le gusta</p><input class="plain-input" data-f="likes" placeholder="Comida, música, regalos…" value="${esc(p.likes)}">
      <p class="group-label">Notas</p><textarea class="note" data-f="notes" placeholder="Pareja, mascota, cosas para recordar…">${esc(p.notes)}</textarea>
      ${id ? `<button class="btn-lg danger" data-delp style="margin-top:28px">Eliminar persona</button>` : ''}`,
    mount: (s, b) => {
      wireSegs(b);
      $('[data-seg="trust"]', b)?.addEventListener('click', () => { $('#trust-lbl', b).textContent = TRUST[segVal(b, 'trust')].label; });
      if (!id) setTimeout(() => $('[data-f="name"]', b).focus({ preventScroll: true }), 450);
      $('[data-delp]', b)?.addEventListener('click', () => {
        if (!confirm(`¿Eliminar a ${p.name}? Sus registros se quedan, pero ya no estarán ligados a esta persona. No se puede deshacer.`)) return;
        db.people = db.people.filter(x => x.id !== id); db.entries.forEach(e => e.people = (e.people || []).filter(x => x !== id));
        db.pauses = db.pauses.filter(x => x.personId !== id); save(); closeAll(); render(); toast('Persona eliminada');
      });
    },
    onRight: s => {
      const b = $('.sheet-body', s.wrap); const g = f => $(`[data-f="${f}"]`, b).value.trim();
      if (!g('name')) { toast('Escribe un nombre'); return; }
      const d = { name: g('name'), emoji: g('emoji'), relation: g('relation'), birthday: g('birthday'), likes: g('likes'), notes: g('notes') };
      if (id) { Object.assign(person(id), d); save(); s.close(); render(); refreshOpenPerson(); const ps = openPersonSheet; if (ps) $('.sheet-nav h2', ps.s.wrap).textContent = d.name; toast('✓ Guardado'); }
      else { const np = newPerson({ ...d, trust: Number(segVal(b, 'trust') || 3) }); s.close(); render(); setTimeout(() => sheetPerson(np.id), 250); }
    } });
}

function sheetTrust(id) {
  const p = person(id);
  openSheet({ title: 'Confianza', left: 'Cancelar', right: 'Guardar', short: true,
    body: `<div class="profile">${avatar(p, 64)}<h3 style="font-size:20px">${esc(p.name)}</h3></div>
      <p class="group-label">Nivel</p><div class="list">${[5, 4, 3, 2, 1].map(i => `<label class="row tap" style="cursor:pointer"><input type="radio" name="tr" value="${i}" ${i === p.trust ? 'checked' : ''} style="accent-color:${TRUST[i].c};width:20px;height:20px"><div class="grow">${TRUST[i].dot} ${TRUST[i].label}</div></label>`).join('')}</div>
      <p class="group-label">¿Por qué cambia? (para que lo recuerdes)</p><input class="plain-input" id="tr-reason" placeholder="Ej. contó lo que le dije">`,
    onRight: s => {
      const b = $('.sheet-body', s.wrap); const v = Number($('input[name="tr"]:checked', b).value);
      setTrust(id, v, $('#tr-reason', b).value.trim()); s.close();
    } });
}
function setTrust(id, v, reason) {
  const p = person(id); if (!p || p.trust === v) return;
  (p.trustHistory ||= []).push({ date: iso(), from: p.trust, to: v, reason }); p.trust = v; save(); render(); refreshOpenPerson();
  toast(`${TRUST[v].dot} Confianza: ${TRUST[v].label}`);
}

function sheetAdvice(id) {
  const a = adviceFor(id); const p = a.p;
  openSheet({ title: 'Mi consejo', left: 'Listo',
    body: `<div class="card" style="padding:20px;text-align:center"><div style="font-size:44px">${a.emoji}</div><h3 style="margin:6px 0 4px;font-size:22px;letter-spacing:-.02em;color:${a.color}">${a.verdict}</h3>
      <p style="margin:0;color:var(--label2);font-size:15px">${a.text}</p></div>
      ${a.notes.length ? `<p class="group-label">Lo que noto</p><div class="list"><ul class="bullets">${a.notes.map(([i, t]) => `<li data-i="${i}">${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${a.trust !== p.trust ? `<p class="group-label">Confianza</p><div class="card" style="padding:14px 16px;font-size:15px">Hoy la tienes en <b>${TRUST[p.trust].label}</b>. Por lo que has vivido, yo la pondría en <b style="color:${TRUST[a.trust].c}">${TRUST[a.trust].label}</b>.
        <div style="margin-top:10px"><button class="btn solid" data-act="setTrust" data-id="${p.id}" data-v="${a.trust}" data-reason="Consejo de la app">Cambiar a ${TRUST[a.trust].label}</button></div></div>` : ''}
      ${a.days ? `<p class="group-label">Distancia sugerida</p><div class="rec-hero l${a.days <= 2 ? 0 : a.days <= 7 ? 1 : a.days <= 21 ? 2 : 3}"><div class="who">${avatar(p, 36)}${esc(p.name)}</div><div class="days">${a.days}<small>${plural(a.days, 'día', 'días')}</small></div><div class="lvl">${LEVELS[a.days <= 2 ? 0 : a.days <= 7 ? 1 : a.days <= 21 ? 2 : 3].name}</div></div>
        ${activePause(p.id) ? '' : `<button class="btn-lg grad" style="margin-top:12px" data-act="startPause" data-id="${p.id}" data-days="${a.days}">⏸️ Iniciar pausa</button>`}` : ''}
      <p class="group-label">Tomar distancia por mi cuenta</p>${seg('pd', [[1, '1 día'], [3, '3 días'], [7, '1 sem'], [14, '2 sem'], [30, '1 mes']], 3)}
      <button class="btn-lg plain" style="margin-top:10px" id="custom-pause">Iniciar esta pausa</button>
      <p class="footnote">Esto es una guía basada en lo que has registrado. Tú tienes la última palabra.</p>`,
    mount: (s, b) => { wireSegs(b); $('#custom-pause', b).onclick = () => startPause(id, Number(segVal(b, 'pd'))); } });
}

function sheetLimit(key) {
  const l = LIMITS[key];
  openSheet({ title: 'Poner un límite', left: 'Listo', short: true,
    body: `<div style="text-align:center;font-size:44px">${l.emoji}</div><h3 style="text-align:center;margin:4px 0;font-size:21px">${l.title}</h3><p style="text-align:center;color:var(--label2);margin:0 0 6px;font-size:15px">${l.intro}</p>
      <p class="group-label">Puedes decir</p>${l.say.map(t => `<div class="script">${t}</div>`).join('')}
      <p class="group-label">Cómo sostenerlo</p><div class="card" style="padding:14px 16px;font-size:15px;line-height:1.45">${l.hold}</div>` });
}

// ---------- Pausas ----------
function startPause(pid, days, entryId) {
  if (activePause(pid)) { toast('Ya hay una pausa activa'); return; }
  db.pauses.push({ id: uid(), personId: pid, start: iso(), days, entryId: entryId || null, ended: false, created: Date.now() });
  save(); render(); refreshOpenPerson();
  // reemplazar el botón en la hoja abierta
  $$(`[data-act="startPause"][data-id="${pid}"]`).forEach(b => { b.outerHTML = `<div class="btn-lg plain" style="pointer-events:none">✓ Pausa iniciada · ${days} ${plural(days, 'día', 'días')}</div>`; });
  toast(`⏸️ Pausa de ${days} ${plural(days, 'día', 'días')} con ${person(pid).name}`);
}

// ---------- Configuración ----------
async function hash(s) {
  if (crypto?.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('circulo:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  let h = 0; for (const c of 'circulo:' + s) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h);
}
function sheetName() {
  openSheet({ title: 'Tu nombre', left: 'Cancelar', right: 'Guardar', short: true,
    body: `<input class="plain-input" id="nm" placeholder="¿Cómo te llamo?" value="${esc(db.settings.name)}" style="margin-top:8px">`,
    mount: (s, b) => setTimeout(() => $('#nm', b).focus(), 400),
    onRight: s => { db.settings.name = $('#nm', s.wrap).value.trim(); save(); s.close(); render(); } });
}
function sheetPin() {
  if (db.settings.pinHash) {
    openSheet({ title: 'Código', left: 'Cerrar', short: true, body: `<p class="footnote" style="margin:4px 4px 14px">Tu app pide el código cada vez que la abres.</p>
      <div class="stack"><button class="btn-lg plain" id="pin-change">Cambiar código</button><button class="btn-lg danger" id="pin-off">Desactivar código</button></div>`,
      mount: (s, b) => {
        $('#pin-off', b).onclick = () => { db.settings.pinHash = null; save(); s.close(); render(); toast('Código desactivado'); };
        $('#pin-change', b).onclick = () => { s.close(); setTimeout(newPinFlow, 300); };
      } });
  } else newPinFlow();
}
function newPinFlow() {
  showLock({ mode: 'set', onDone: async pin => { db.settings.pinHash = await hash(pin); save(); render(); toast('🔒 Código activado'); } });
}
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const name = `circulo-respaldo-${iso()}.json`; const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file], title: 'Respaldo de Círculo' }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importData() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
  i.onchange = async () => {
    try {
      const d = JSON.parse(await i.files[0].text());
      if (!Array.isArray(d.people) || !Array.isArray(d.entries)) throw 0;
      if (!confirm(`¿Restaurar este respaldo? Reemplaza lo que tienes ahora (${d.people.length} personas, ${d.entries.length} registros).`)) return;
      db = { ...blank(), ...d, settings: { ...blank().settings, ...(d.settings || {}) } }; save(); render(); toast('✓ Respaldo restaurado');
    } catch { toast('Ese archivo no es un respaldo válido'); }
  };
  i.click();
}
function wipe() {
  if (!confirm('¿Borrar TODO? Personas, registros, ánimo y pausas. Esto no se puede deshacer.')) return;
  if (!confirm('¿Seguro? Te recomiendo guardar un respaldo antes.')) return;
  db = blank(); save(); render(); toast('Todo borrado');
}

// ---------- Bloqueo ----------
function showLock({ mode = 'unlock', onDone } = {}) {
  const L = $('#lock'); let pin = '', first = null;
  const title = () => mode === 'unlock' ? 'Escribe tu código' : first ? 'Confírmalo' : 'Crea un código de 4 dígitos';
  const draw = () => {
    L.innerHTML = `<div class="logo">⭕️</div><h2>${title()}</h2><div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}
      <button class="ghost" data-c>${mode === 'set' ? 'Cancelar' : ''}</button><button data-n="0">0</button><button class="ghost" data-b>Borrar</button></div>`;
  };
  draw(); L.hidden = false;
  L.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c !== undefined) { if (mode === 'set') { L.hidden = true; } return; }
    if (b.dataset.b !== undefined) { pin = pin.slice(0, -1); draw(); return; }
    if (pin.length >= 4) return;
    pin += b.dataset.n; draw();
    if (pin.length < 4) return;
    if (mode === 'unlock') {
      if (await hash(pin) === db.settings.pinHash) { L.hidden = true; L.innerHTML = ''; render(); }
      else { $('.dots', L).classList.add('shake'); setTimeout(() => { pin = ''; draw(); }, 420); }
    } else if (!first) { first = pin; pin = ''; setTimeout(draw, 150); }
    else if (first === pin) { L.hidden = true; L.innerHTML = ''; onDone && onDone(pin); }
    else { $('.dots', L).classList.add('shake'); first = null; setTimeout(() => { pin = ''; draw(); toast('No coincidieron, intenta de nuevo'); }, 420); }
  };
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (db.settings.pinHash && Date.now() - hiddenAt > 60_000 && $('#lock').hidden) showLock();
});

// ---------- Aviso ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

// ---------- Acciones (delegadas) ----------
const ACT = {
  tab: d => { if (state.tab === d.tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; } closeAll(); state.tab = d.tab; scrollTo(0, 0); render(); },
  newEntry: () => sheetPickType(),
  newEntryFor: d => sheetPickType(d.id),
  entryForm: d => openSheet(entryFormOpts(d.type)),
  entry: d => sheetEntry(d.id),
  newPerson: () => sheetPersonForm(),
  editPerson: d => sheetPersonForm(d.id),
  person: d => sheetPerson(d.id),
  trust: d => sheetTrust(d.id),
  setTrust: (d, b) => { setTrust(d.id, Number(d.v), d.reason || ''); b.outerHTML = `<div class="btn-lg plain" style="pointer-events:none">✓ Confianza: ${TRUST[d.v].label}</div>`; },
  advice: d => sheetAdvice(d.id),
  mood: d => sheetMood(d.v ? Number(d.v) : undefined),
  startPause: d => startPause(d.id, Number(d.days), d.entry),
  endPause: d => { const pz = db.pauses.find(p => p.id === d.id); if (pz) { pz.ended = true; save(); render(); refreshOpenPerson(); toast('Pausa terminada'); } },
  extendPause: d => { const pz = db.pauses.find(p => p.id === d.id); if (pz) { pz.days += 7; save(); render(); toast('⏸️ +7 días'); } },
  resolveEntry: d => { const e = db.entries.find(x => x.id === d.id); if (e) { e.resolved = true; save(); render(); toast('✓ Resuelto'); } },
  repairEntry: d => { const e = db.entries.find(x => x.id === d.id); if (e) { e.repaired = true; save(); render(); toast('🩹 Bien hecho'); } },
  keepPromise: d => { const e = db.entries.find(x => x.id === d.id); if (e) { e.promiseStatus = 'cumplida'; save(); render(); toast('🤝 Promesa cumplida'); } },
  dismiss: (d, b) => { db.dismissed[d.id] = iso(); save(); const card = b.closest('.alert'); card.style.transition = 'opacity .2s, transform .2s'; card.style.opacity = 0; card.style.transform = 'scale(.96)'; setTimeout(render, 200); },
  openLimit: d => sheetLimit(d.id),
  setName: sheetName, setPin: sheetPin, exportData, importData, wipe,
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (fn) { e.preventDefault(); fn(b.dataset, b, e); }
});

// ---------- Inicio ----------
render();
if (db.settings.pinHash) showLock();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
