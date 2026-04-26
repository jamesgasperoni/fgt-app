import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function Income() {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ date: today(), vendor: '', amount_invoiced: '', amount_received: '', method: 'Check', job_number: '', note: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('transactions').select('*').eq('type','income').order('date',{ascending:false})
    setTxns(data || [])
    setLoading(false)
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.date || !form.vendor.trim() || !form.amount_received || Number(form.amount_received) <= 0) {
      alert('Date, customer, and amount received are required.'); return
    }
    await supabase.from('transactions').insert({
      date: form.date, vendor: form.vendor.trim(), category: 'Revenue',
      amount: Number(form.amount_received),
      method: form.method, job_number: form.job_number || null,
      note: form.note || (form.amount_invoiced ? `Invoiced: $${Number(form.amount_invoiced).toFixed(2)}` : null),
      type: 'income'
    })
    setForm({ date: today(), vendor: '', amount_invoiced: '', amount_received: '', method: 'Check', job_number: '', note: '' })
    showToast('Payment recorded')
    load()
  }

  async function deleteTxn(id) {
    if (!confirm('Remove?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(p => p.filter(t => t.id !== id))
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200) }

  const totalReceived = txns.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <Layout title="Income">
      <div className="page-header">
        <h2>Income</h2>
        <span style={{fontSize:13,fontWeight:600,color:'#15803d'}}>Total collected: {fmt(totalReceived)}</span>
      </div>
      <div className="page-body">

        <div className="card">
          <div className="card-header"><h3>Record payment received</h3></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-row">
                <div className="field"><label>Date received</label><input type="date" value={form.date} onChange={f('date')} /></div>
                <div className="field" style={{flex:2}}><label>Customer / source</label><input value={form.vendor} onChange={f('vendor')} placeholder="Customer name" /></div>
                <div className="field"><label>Job #</label><input value={form.job_number} onChange={f('job_number')} placeholder="optional" /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Invoice amount ($)</label><input type="number" step="0.01" min="0" value={form.amount_invoiced} onChange={f('amount_invoiced')} placeholder="0.00" /></div>
                <div className="field"><label>Amount received ($) *</label><input type="number" step="0.01" min="0" value={form.amount_received} onChange={f('amount_received')} placeholder="0.00" /></div>
                <div className="field"><label>Payment method</label>
                  <select value={form.method} onChange={f('method')}>
                    {['Check','Cash','Credit card','Zelle','Venmo','ACH'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="field"><label>Note</label><input value={form.note} onChange={f('note')} placeholder="optional" /></div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={save}>Save payment</button>
                <button className="btn" onClick={()=>setForm({date:today(),vendor:'',amount_invoiced:'',amount_received:'',method:'Check',job_number:'',note:''})}>Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Payment history</h3></div>
          <div className="table-wrap">
            {loading ? <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>Loading…</div>
            : txns.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No payments recorded yet.</div>
            : (
              <table>
                <thead><tr><th>Date</th><th>Customer</th><th>Job #</th><th>Method</th><th>Note</th><th className="text-right">Amount</th><th></th></tr></thead>
                <tbody>
                  {txns.map(t=>(
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td style={{fontWeight:500}}>{t.vendor}</td>
                      <td className="text-center">{t.job_number||'—'}</td>
                      <td>{t.method}</td>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{t.note}</td>
                      <td className="text-right mono" style={{fontWeight:600,color:'#15803d'}}>{fmt(t.amount)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={()=>deleteTxn(t.id)}>Remove</button></td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--gray)'}}>
                    <td colSpan={5} style={{fontWeight:600,fontSize:12}}>TOTAL RECEIVED</td>
                    <td className="text-right mono" style={{fontWeight:700,color:'#15803d'}}>{fmt(totalReceived)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
