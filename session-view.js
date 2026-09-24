// session-view.js — Seans özeti DOM'u (2026-09-25). Saf render: mantık session.js'te (summarizeSession,
// issueSentence), burada sadece sonucu biçimlendirip el'e basar. fmtTime app.js'teki ile birebir aynı.
import { issueSentence } from './session.js?v=55';

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function clickableTime(t, onPickKick) {
  const span = document.createElement('span');
  span.textContent = fmtTime(t);
  span.className = 'sessionTime';
  span.addEventListener('click', () => onPickKick(t));
  return span;
}

/**
 * summary: summarizeSession() çıktısı. el: doldurulacak <div>. onPickKick(t): bir vuruş seçilince çağrılır.
 * summary.count < 2 ise (tek vuruşluk seansta özetin anlamı yok) el gizlenir.
 */
export function renderSessionSummary(el, summary, onPickKick) {
  el.textContent = '';
  if (summary.count < 2) { el.hidden = true; return; }
  el.hidden = false;

  const title = document.createElement('h2');
  title.textContent = 'Seans özeti';
  el.appendChild(title);

  const overview = document.createElement('p');
  overview.textContent = summary.avg === null
    ? `${summary.count} vuruş · puanlanan yok`
    : `${summary.count} vuruş · ortalama ${summary.avg} / 100`;
  el.appendChild(overview);

  if (summary.best) {
    const p = document.createElement('p');
    p.append('En iyi: ', clickableTime(summary.best.t, onPickKick), ` · ${summary.best.total}`);
    el.appendChild(p);
  }
  // Tek vuruş puanlandıysa en zayıf = en iyi: aynı satırı tekrar etme.
  if (summary.worst && summary.scored > 1) {
    const p = document.createElement('p');
    p.append('En zayıf: ', clickableTime(summary.worst.t, onPickKick), ` · ${summary.worst.total}`);
    el.appendChild(p);
  }

  if (summary.unscored > 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = `${summary.unscored} vuruşta 3D iskelet çıkmadı, puanlanmadı.`;
    el.appendChild(p);
  }

  if (summary.issues.length) {
    const h = document.createElement('p');
    h.textContent = 'Sık tekrar eden farklar:';
    el.appendChild(h);
    const ul = document.createElement('ul');
    for (const issue of summary.issues) {
      const li = document.createElement('li');
      li.textContent = issueSentence(issue);
      ul.appendChild(li);
    }
    el.appendChild(ul);
  }
}
