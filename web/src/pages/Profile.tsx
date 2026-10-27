import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { IconChannel, IconChevronRight, IconClub, IconDocument, IconSettings, type IconComponent } from '../components/Icons';
import { useSession } from '../session';
import { openLink } from '../tg';

function Row({ Icon, label, value, to, onClick }: { Icon: IconComponent; label: string; value: ReactNode; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="row-icon"><Icon size={20} /></span>
      <span className="row-label">{label}</span>
      <span className="row-value">{value}</span>
      {(to || onClick) && <IconChevronRight size={18} className="row-chevron" />}
    </>
  );
  if (to) return <Link className="row" to={to}>{inner}</Link>;
  if (onClick) return <button className="row" onClick={onClick}>{inner}</button>;
  return <div className="row">{inner}</div>;
}

export function Profile() {
  const { session } = useSession();
  const s = session!;
  const name = [s.user.first_name, s.user.last_name].filter(Boolean).join(' ');

  return (
    <>
      <div className="profile-head">
        <Avatar name={name} url={s.user.photo_url} size={88} />
        <h1>{name}</h1>
        {s.user.username && <span className="muted">@{s.user.username}</span>}
      </div>

      <div className="rows">
        <Row
          Icon={IconChannel}
          label="Kanal obunasi"
          value={s.subscribed ? <span className="state-ok">Faol</span> : 'Obuna emas'}
          onClick={s.subscribed ? undefined : () => openLink(s.channelUrl)}
        />
        <Row Icon={IconClub} label="AI Club" value={s.club ? <span className="state-ok">A'zo</span> : "A'zo emas"} to="/club" />
        <Row
          Icon={IconDocument}
          label="Waitlist"
          value={s.waitlist.length ? s.waitlist.map((w) => (w === 'club' ? 'AI Club' : 'Kurslar')).join(', ') : "Yo'q"}
          to="/club"
        />
      </div>

      {s.admin && (
        <div className="rows">
          <Row Icon={IconSettings} label="Admin panel" value="" to="/admin" />
        </div>
      )}
    </>
  );
}
