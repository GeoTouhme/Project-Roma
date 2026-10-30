import { useEffect, useState } from 'react';
import api from '@/lib/api';
type Request = { _id: string; owner: string; type: string; status: string; response?: string; staffNote?: string; resolutionEvidence?: string; legalHold: boolean; createdAt: string };
export default function PrivacyRequests() {
  const [orderReviews, setOrderReviews] = useState<any[]>([]);
  const [retention, setRetention] = useState<any>(null);
  const [rows, setRows] = useState<Request[]>([]), [selected, setSelected] = useState<Request | null>(null);
  const [message, setMessage] = useState(''), [page, setPage] = useState(1), [count, setCount] = useState(0), [busy, setBusy] = useState(false);
  const load = () => api.get(`/api/admin/privacy/requests?page=${page}`).then(({ data }) => { setRows(data.data); setCount(data.count); });
  useEffect(() => { api.get('/api/admin/orders/review-queue').then(({data}) => setOrderReviews(data.data || [])).catch(() => setMessage('Order review queue unavailable.')); api.get('/api/admin/privacy/retention').then(({data}) => setRetention(data.data)).catch(() => setMessage('Retention verification unavailable.')); }, []);
  useEffect(() => { load().catch(() => setMessage('Unable to load requests.')); }, [page]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true);
    try { await api.patch(`/api/admin/privacy/requests/${selected._id}`, { ...selected, response: selected.response || '', staffNote: selected.staffNote || '', resolutionEvidence: selected.resolutionEvidence || '' }); setMessage('Review saved. No data was deleted.'); setSelected(null); await load(); }
    catch (error: any) { setMessage(error.response?.data?.message || 'Review could not be saved.'); } finally { setBusy(false); }
  }
  return <section className="p-6 space-y-4"><h1 className="text-2xl font-bold">Privacy requests</h1>
    <p>Review requests, coordinate vendor and backup records, and record retention holds. Deletion completion is disabled pending an approved erasure procedure.</p>
    <p role="status">{message}</p>
    <table className="w-full text-left"><caption className="sr-only">Privacy request queue</caption><thead><tr>{['Type', 'Status', 'Submitted', 'Review'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row._id}><td>{row.type}</td><td>{row.status}{row.legalHold ? ' (hold)' : ''}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td><td><button className="underline p-2" onClick={() => setSelected({ ...row })}>Review {row._id.slice(-6)}</button></td></tr>)}</tbody></table>
    <div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 50 >= count} onClick={() => setPage(p => p + 1)}>Next</button></div>
    <h2 className="text-xl font-semibold">Retention verification</h2><p>{retention ? `Policy configured: ${retention.configured ? 'yes' : 'no'}. Analytics TTL installed: ${retention.analyticsTtlVerified ? 'yes' : 'no'}. Open holds: ${retention.holds}. Unresolved payments: ${retention.unresolvedPayments}. Destructive cleanup disabled.` : 'Loading retention verification…'}</p>
    <h2 className="text-xl font-semibold">Delivery and refund review</h2><ul>{orderReviews.map(row => <li key={row._id}><a className="underline" href={`/orders/${row._id}`}>{row.orderNo}</a>: {row.status} {row.cancellationEffectsPending ? '— cancellation refund pending' : '— delivery remedy review required'}</li>)}</ul>
    {selected && <form onSubmit={save} className="grid gap-3 max-w-xl border p-4"><h2>Review {selected.type} request</h2>
      <label>State<select className="block border p-2" value={selected.status} onChange={e => setSelected({ ...selected, status: e.target.value })}>{['submitted','reviewing','needs_information','held','resolved','declined'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label><input type="checkbox" checked={selected.legalHold} onChange={e => setSelected({ ...selected, legalHold: e.target.checked })} /> Retention or legal hold</label>
      <label>Internal note<textarea className="block w-full border p-2" maxLength={2000} value={selected.staffNote || ''} onChange={e => setSelected({ ...selected, staffNote: e.target.value })} /></label>
      <label>Response visible to customer<textarea className="block w-full border p-2" maxLength={2000} value={selected.response || ''} onChange={e => setSelected({ ...selected, response: e.target.value })} /></label>
      <label>Resolution evidence reference<input className="block w-full border p-2" maxLength={500} value={selected.resolutionEvidence || ''} onChange={e => setSelected({ ...selected, resolutionEvidence: e.target.value })} /></label>
      <button disabled={busy} className="bg-gray-900 text-white p-3">Save review</button><button type="button" onClick={() => setSelected(null)}>Close</button>
    </form>}
  </section>;
}
