import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import service from '../../interceptor/fetchInterceptor';
import identity from '../../config/storeIdentity.json';
export default function PrivacyRequests() {
  const authenticated = useSelector(state => state.auth.isAuthenticated);
  const [requests, setRequests] = useState([]), [type, setType] = useState('access');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const load = () => service.get('/privacy/requests').then(result => setRequests(result.data || []));
  useEffect(() => { if (authenticated) load().catch(() => setMessage('Unable to load requests. Please retry.')); }, [authenticated]);
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try { const result = await service.post('/privacy/requests', { type }); setMessage(result.message); await load(); }
    catch (error) { setMessage(error.message || 'Request unavailable. Please contact the store.'); } finally { setBusy(false); }
  }
  async function download() {
    setBusy(true);
    try {
      const data = await service.get('/privacy/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'balport-account-export.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Export downloaded. Keep this file private. Vendor and backup records require staff review.');
    } catch (error) { setMessage(error.message || 'Export unavailable.'); } finally { setBusy(false); }
  }
  return <section className="max-w-3xl mx-auto p-6 text-gray-900">
    <h1 className="text-3xl font-bold mb-4">Privacy requests</h1>
    <p className="mb-4">Request access, correction, deletion, or an opt out. Staff review identity, applicable retention requirements, vendor records and backups before completing requests. Submitting a deletion request does not immediately erase data.</p>
    <p className="mb-4">You can also contact <a className="underline" href={`mailto:${identity.email}`}>{identity.email}</a> or <a className="underline" href={`tel:${identity.phone}`}>{identity.phoneDisplay}</a>. Please do not send passwords or identity documents by email.</p>
    {!authenticated ? <p><Link className="underline" to="/login">Sign in</Link> to submit and track account requests, or contact the store using the details above.</p> : <>
      <button className="border rounded p-3 mb-4" disabled={busy} onClick={download}>Download my account data</button>
      <form onSubmit={submit} className="flex flex-wrap gap-3 mb-6">
        <label htmlFor="privacy-request-type" className="self-center">Request type</label>
        <select id="privacy-request-type" value={type} onChange={event => setType(event.target.value)} className="border rounded p-3">
          <option value="access">Access</option><option value="correct">Correction</option><option value="delete">Deletion</option><option value="opt_out">Opt out</option>
        </select><button className="bg-gray-900 text-white rounded p-3" disabled={busy}>Submit for review</button>
      </form>
      <h2 className="text-xl font-bold">Your requests</h2>
      {!requests.length && <p>No requests submitted.</p>}
      <ul>{requests.map(request => <li key={request._id} className="border-b py-3"><strong>{request.type}</strong>: {request.status} — {new Date(request.createdAt).toLocaleDateString()}{request.response && <p>{request.response}</p>}</li>)}</ul>
    </>}
    <p role="status" className="my-4">{message}</p>
  </section>;
}
