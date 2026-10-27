import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { IconGallery, IconLink } from '../components/Icons';
import { TYPE_LABEL, type PostType } from '../types';

type Series = { date: string; newUsers: number; active: number; starts: number; subscribed: number };
type StatsData = {
  days: number;
  summary: {
    users: { total: number; today: number; started: number; appUsers: number; subscribed: number; blocked: number; club: number };
    active: { today: number; dau: number; wau: number; mau: number };
    startPresses: { total: number; today: number };
    waitlist: { club: number; course: number };
  };
  series: Series[];
  period: Record<string, number>;
  funnel: { label: string; value: number }[];
  sources: { source: string; users: number; opened: number; subscribed: number }[];
  topPosts: { id: number; title: string; type: PostType; views: number; uniq: number }[];
  keywords: { keyword: string; hits: number; uniq: number }[];
  banners: { id: number; title: string; clicks: number; uniq: number }[];
  linkClicks: { id: number; title: string; clicks: number; uniq: number }[];
};

const METRICS: { key: keyof Omit<Series, 'date'>; label: string }[] = [
  { key: 'active', label: 'Faol (ilova)' },
  { key: 'newUsers', label: 'Yangi foydalanuvchi' },
  { key: 'starts', label: '/start' },
  { key: 'subscribed', label: 'Yangi obuna' },
];

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const fmt = (n: number) => n.toLocaleString('ru-RU');

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{fmt(value)}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ data, metric }: { data: Series[]; metric: keyof Omit<Series, 'date'> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d[metric]));
  const total = data.reduce((s, d) => s + d[metric], 0);
  const h = hover != null ? data[hover] : null;
  return (
    <div className="chart">
      <div className="chart-readout">
        {h ? (
          <><b>{fmt(h[metric])}</b> <span>{h.date}</span></>
        ) : (
          metric === 'active' ? (
            <><b>{fmt(Math.round(total / data.length))}</b> <span>kunlik o'rtacha, {data.length} kun</span></>
          ) : (
            <><b>{fmt(total)}</b> <span>jami, {data.length} kun</span></>
          )
        )}
      </div>
      <div className="bars" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.date}
            className={hover === i ? 'bar-col hover' : 'bar-col'}
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          >
            <div className="bar" style={{ height: `${(d[metric] / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-axis">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

export function Stats() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsData | null>(null);
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('active');

  useEffect(() => {
    api.get<StatsData>(`/admin/stats?days=${days}`).then(setData);
  }, [days]);

  if (!data) return <div className="center-screen"><div className="spinner" /></div>;
  const { users, active, startPresses, waitlist } = data.summary;
  const p = data.period;
  const top = data.funnel[0]?.value || 0;

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Jami foydalanuvchi" value={users.total} sub={`bugun +${users.today}`} />
        <Kpi label="/start bosgan" value={users.started} sub={`${fmt(startPresses.total)} marta, bugun ${startPresses.today}`} />
        <Kpi label="Ilovani ochgan" value={users.appUsers} sub={`${pct(users.appUsers, users.started)} /start bosganlardan`} />
        <Kpi label="Bugun faol" value={active.today} sub={`so'nggi 24 soat: ${active.dau}`} />
        <Kpi label="Haftalik faol" value={active.wau} sub={`oylik ${fmt(active.mau)} · qaytish ${pct(active.dau, active.mau)}`} />
        <Kpi label="Kanalga obuna" value={users.subscribed} sub={`${pct(users.subscribed, users.total)} foydalanuvchilardan`} />
        <Kpi label="Botni bloklagan" value={users.blocked} sub={`${pct(users.blocked, users.started)} /start bosganlardan`} />
        <Kpi label="Waitlist" value={waitlist.club + waitlist.course} sub={`club ${waitlist.club} · kurs ${waitlist.course}`} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div className="seg" role="tablist">
            {METRICS.map((m) => (
              <button key={m.key} role="tab" aria-selected={metric === m.key} className={metric === m.key ? 'active' : ''} onClick={() => setMetric(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
          <select className="input input-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Davr">
            <option value={7}>7 kun</option>
            <option value={30}>30 kun</option>
            <option value={90}>90 kun</option>
          </select>
        </div>
        <BarChart data={data.series} metric={metric} />
        <div className="mini-stats">
          <div><b>{fmt(p.appOpens)}</b>ilova ochilishi</div>
          <div><b>{fmt(p.activeUsers)}</b>faol foydalanuvchi</div>
          <div><b>{fmt(p.returning)}</b>qaytib kelgan</div>
          <div><b>{fmt(p.postViews)}</b>material ko'rishlari</div>
          <div><b>{fmt(p.newSubscribers)}</b>yangi obuna</div>
          <div><b>{fmt(p.unsubscribed)}</b>obunadan chiqqan</div>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">Voronka</h2>
        <div className="funnel">
          {data.funnel.map((f, i) => (
            <div key={f.label} className="funnel-row">
              <span>{f.label}</span>
              <div className="funnel-track"><div className="funnel-bar" style={{ width: `${top ? (f.value / top) * 100 : 0}%` }} /></div>
              <span className="funnel-value">{fmt(f.value)}{i > 0 && <span>{pct(f.value, data.funnel[i - 1].value)}</span>}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="section-title">Manbalar <span>/start havolasi bo'yicha</span></h2>
          {data.sources.length ? (
            <table className="table">
              <thead><tr><th>Manba</th><th>Odam</th><th>Ilova</th><th>Obuna</th></tr></thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source || <span className="muted">To'g'ridan-to'g'ri</span>}</td>
                    <td>{s.users}</td><td>{pct(s.opened, s.users)}</td><td>{pct(s.subscribed, s.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="table-empty">Hali ma'lumot yo'q</p>}
        </section>

        <section className="panel">
          <h2 className="section-title">Top materiallar <span>{data.days} kun</span></h2>
          {data.topPosts.length ? (
            <table className="table">
              <thead><tr><th>Material</th><th>Unikal</th><th>Jami</th></tr></thead>
              <tbody>
                {data.topPosts.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/admin/posts/${t.id}`}>{t.title}</Link><span className="cell-meta">{TYPE_LABEL[t.type]}</span></td>
                    <td>{t.uniq}</td><td>{t.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="table-empty">Hali ma'lumot yo'q</p>}
        </section>

        <section className="panel">
          <h2 className="section-title">Kalit so'zlar</h2>
          {data.keywords.length ? (
            <table className="table">
              <thead><tr><th>Kalit so'z</th><th>Unikal</th><th>Jami</th></tr></thead>
              <tbody>{data.keywords.map((k) => <tr key={k.keyword}><td>{k.keyword}</td><td>{k.uniq}</td><td>{k.hits}</td></tr>)}</tbody>
            </table>
          ) : <p className="table-empty">Hali ma'lumot yo'q</p>}
        </section>

        <section className="panel">
          <h2 className="section-title">Bannerlar va havolalar</h2>
          {data.banners.length || data.linkClicks.length ? (
            <table className="table">
              <thead><tr><th>Element</th><th>Unikal</th><th>Jami</th></tr></thead>
              <tbody>
                {data.banners.map((b) => (
                  <tr key={`b${b.id}`}><td><span className="cell-icon"><IconGallery size={16} />{b.title || `Rasmli slayd #${b.id}`}</span></td><td>{b.uniq}</td><td>{b.clicks}</td></tr>
                ))}
                {data.linkClicks.map((l) => (
                  <tr key={`l${l.id}`}><td><span className="cell-icon"><IconLink size={16} />{l.title}</span></td><td>{l.uniq}</td><td>{l.clicks}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="table-empty">Hali ma'lumot yo'q</p>}
        </section>
      </div>
    </div>
  );
}
