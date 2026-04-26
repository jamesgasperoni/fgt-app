import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

const today = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ job_number:'', customer:'', location:'', start_date:today(), end_date:'', invoice_amount:'', materials:'', helper_days:'', helper_cost:'', other_expenses:'', notes:'' })

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [form, setForm] = useState(blank())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('jobs').select('*').order('created_at', {ascending:false})
    setJobs(data || [])
    setLoading(false)
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function save() {
    const { job_number, customer, invoice_amount } = form
    if (!customer.trim()) { alert('Customer name required.'); return }
    const row = {
      ...form,
      invoice_amount: Number(form.invoice_amount) || 0,
      materials: Number(form.materials) || 0,
      helper_days: Number(form.helper_days) || 0,
      helper_cost: Number(form.helper_cost) || 0,
      other_expenses: Number(form.other_expenses) || 0,
    }
    if (editing) {
      await supabase.from('jobs').update(row).eq('id', editing)
      setEditing(null)
    } else {
      await supabase.from('jobs').insert(row)
    }
    setForm(blank())
    showToast(editing ? 'Job updated' : 'Job saved')
    load()
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job?')) return
    await supabase.from('jobs').delete().eq('id', id)
    setJobs(prev => prev.filter(j => j.id !== id))
    showToast('Deleted')
  }

  function editJob(j) {
    setEditing(j.id)
    setForm({ ...j })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200) }

  function calcJob(j) {
    const costs = Number(j.materials) + Number(j.helper_cost) + Number(j.other_expenses)
    const profit = Number(j.invoice_amount) - costs
    const margin = j.invoice_amount > 0 ? profit / Number(j.invoice_amount) : 0
    return { costs, profit, margin }
  }

  const totals = jobs.reduce((acc, j) => {
    const c = calcJob(j)
    return { inv: acc.inv + Number(j.invoice_amount), costs: acc.costs + c.costs, profit: acc.profit + c.profit }
  }, { inv: 0, costs: 0, profit: 0 })

  return (
    <Layout title="Jobs">
      <div className="page-header">
        <h2>Jobs</h2>
        <div style={{display:'flex',gap:16,fontSize:13}}>
          <span><strong>{jobs.length}</strong> jobs</span>
          <span>Invoiced: <strong>{fmt(totals.inv)}</strong></span>
          <span>Profit: <strong style={{color:'#15803d'}}>{fmt(totals.profit)}</strong></span>
        </div>
      </div>
      <div className="page-body">

        <div className="card">
          <div className="card-header"><h3>{editing ? 'Edit job' : 'New job'}</h3>{editing && <button className="btn btn-sm" onClick={()=>{setEditing(null);setForm(blank())}}>Cancel edit</button>}</div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-row">
                <div className="field"><label>Job #</label><input value={form.job_number} onChange={f('job_number')} placeholder="e.g. 24" /></div>
                <div className="field" style={{flex:2}}><label>Customer *</label><input value={form.customer} onChange={f('customer')} placeholder="Customer name" /></div>
                <div className="field" style={{flex:2}}><label>Location</label><input value={form.location} onChange={f('location')} placeholder="e.g. Royal Oak" /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Start date</label><input type="date" value={form.start_date} onChange={f('start_date')} /></div>
                <div className="field"><label>End date</label><input type="date" value={form.end_date} onChange={f('end_date')} /></div>
                <div className="field"><label>Invoice amount ($)</label><input type="number" step="0.01" min="0" value={form.invoice_amount} onChange={f('invoice_amount')} placeholder="0.00" /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Materials ($)</label><input type="number" step="0.01" min="0" value={form.materials} onChange={f('materials')} placeholder="0.00" /></div>
                <div className="field"><label>Helper days</label><input type="number" step="0.5" min="0" value={form.helper_days} onChange={f('helper_days')} placeholder="0" /></div>
                <div className="field"><label>Helper cost ($)</label><input type="number" step="0.01" min="0" value={form.helper_cost} onChange={f('helper_cost')} placeholder="0.00" /></div>
                <div className="field"><label>Other expenses ($)</label><input type="number" step="0.01" min="0" value={form.other_expenses} onChange={f('other_expenses')} placeholder="0.00" /></div>
              </div>
              <div className="field"><label>Notes</label><input value={form.notes} onChange={f('notes')} placeholder="Scope, materials used, anything notable…" /></div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={save}>{editing ? 'Update job' : 'Save job'}</button>
                <button className="btn" onClick={()=>{setForm(blank());setEditing(null)}}>Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Job log</h3></div>
          <div className="table-wrap">
            {loading ? <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>Loading…</div>
            : jobs.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No jobs yet.</div>
            : (
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Customer</th><th>Location</th><th>Dates</th>
                    <th className="text-right">Invoice</th><th className="text-right">Costs</th>
                    <th className="text-right">Profit</th><th className="text-right">Margin</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => {
                    const { costs, profit, margin } = calcJob(j)
                    return (
                      <tr key={j.id}>
                        <td style={{color:'var(--text-muted)'}}>{j.job_number || '—'}</td>
                        <td style={{fontWeight:500}}>{j.customer}</td>
                        <td>{j.location}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{j.start_date}{j.end_date && ` – ${j.end_date}`}</td>
                        <td className="text-right mono">{fmt(j.invoice_amount)}</td>
                        <td className="text-right mono">{fmt(costs)}</td>
                        <td className="text-right mono" style={{color: profit >= 0 ? '#15803d' : '#b91c1c', fontWeight:600}}>{fmt(profit)}</td>
                        <td className="text-right">
                          <span className={`badge ${margin >= 0.35 ? 'badge-green' : margin >= 0.20 ? 'badge-yellow' : 'badge-red'}`}>{fmtPct(margin)}</span>
                        </td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm" onClick={()=>editJob(j)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={()=>deleteJob(j.id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{background:'var(--gray)'}}>
                    <td colSpan={4} style={{fontWeight:600,fontSize:12}}>TOTALS</td>
                    <td className="text-right mono" style={{fontWeight:700}}>{fmt(totals.inv)}</td>
                    <td className="text-right mono" style={{fontWeight:700}}>{fmt(totals.costs)}</td>
                    <td className="text-right mono" style={{fontWeight:700,color:'#15803d'}}>{fmt(totals.profit)}</td>
                    <td className="text-right"><span className="badge badge-green">{totals.inv > 0 ? fmtPct(totals.profit/totals.inv) : '—'}</span></td>
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
