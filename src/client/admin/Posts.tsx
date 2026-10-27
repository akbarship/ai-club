import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { IconAdd, IconPin } from '../components/Icons';
import { formatDate } from '../components/PostCard';
import { ACCESS_LABEL, TYPE_LABEL, type Access, type PostType } from '../types';

type Row = { id: number; type: PostType; title: string; access: Access; status: string; pinned: number; updated_at: number; views: number };

export function Posts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api.get<Row[]>('/admin/posts').then(setRows);
  }, []);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Materiallar</h1>
        <Link className="btn btn-primary btn-sm" to="/admin/posts/new"><IconAdd size={17} />Yangi material</Link>
      </div>
      {rows && !rows.length && <div className="empty">Hali material yo'q. Birinchi qo'llanmani yozing.</div>}
      {!!rows?.length && (
        <div className="admin-list">
          {rows.map((r) => (
            <Link key={r.id} to={`/admin/posts/${r.id}`} className="admin-row">
              <div className="admin-row-main">
                <span className="admin-row-title">{r.title}</span>
                <span className="admin-row-meta">
                  <span className={r.status === 'published' ? 'status status-ok' : 'status'}>
                    {r.status === 'published' ? 'Chop etilgan' : 'Qoralama'}
                  </span>
                  {TYPE_LABEL[r.type]} · {ACCESS_LABEL[r.access]} · {formatDate(r.updated_at)}
                  {!!r.pinned && <IconPin size={14} bold />}
                </span>
              </div>
              <div className="admin-row-num">{r.views}<span>ko'rgan</span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
