import { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0
  var n = parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function blank() {
  return {
    job_number: '', customer: '', location: '',
    start_date: today(), end_date: '',
    invoice_amount: '', materials: '', helper_days: '',
    helper_cost: '', other_expenses: '', notes: '', status: 'unpaid',
  }
}

export default function Jobs() {
  var [jobs, setJobs] = useState([])
  var [form, setForm] = useState(blank())
  var [loading, setLoading] = useState(true)
  var [toast, setToast] = useState('')
  var [editing, setEditing] = useState(null)
  var [filterStatus, setFilterStatus] = useState('all')
  var [uploading, setUploading] = useState(false)
  var [pendingFiles, setPendingFiles] = useState([])
  var fileRef = useRef()

  useEffect(function() { load() }, [])

  async function load() {
    var res = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
    setJobs(res.data || [])
    setLoading(false)
  }

  function setField(key) {
    return function(e) {
      setForm(function(prev) {
        var next = Object.assign({}, prev)
        next[key] = e.target.value
        return next
      })
    }
  }

  function onFileSelect(e) {
    var files = Array.from(e.target.files)
    setPendingFiles(function(prev) { return prev.concat(files) })
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePending(idx) {
    setPendingFiles(function(prev) { return prev.filter(function(_, i) { return i !== idx }) })
  }

  async function uploadFilesForJob(jobId, files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i]
      var fileName = Date.now() + '_' + file.name
      var path = 'job-' + jobId + '/' + fileName
      var upRes = await supabase.storage.from('job-files').upload(path, file)
      if (!upRes.error) {
        var urlRes = supabase.storage.from('job-files').getPublicUrl(path)
        await supabase.from('job_attachments').insert({
          job_id: jobId,
          file_name: file.name,
          file_url: urlRes.data.publicUrl,
          file_size: (file.size / 1024).toFixed(1) + ' KB',
          file_type: file.type,
        })
      }
    }
  }

  async function save() {
    if (!form.customer.trim()) { alert('Customer name is required.'); return }
    var row = {
      job_number:     form.job_number,
      customer:       form.customer.trim(),
      location:       form.location,
      start_date:     form.start_date,
      end_date:       form.end_date || null,
      invoice_amount: toNum(form.invoice_amount),
      materials:      toNum(form.materials),
      helper_days:    toNum(form.helper_days),
      helper_cost:    toNum(form.helper_cost),
      other_expenses: toNum(form.other_expenses),
      notes:          form.notes || null,
      status:         form.status,
    }
    setUploading(true)
    if (editing) {
      await supabase.from('jobs').update(row).eq('id', editing)
      if (pendingFiles.length > 0) await uploadFilesForJob(editing, pendingFiles)
      setEditing(null)
    } else {
      var insRes = await supabase.from('jobs').insert(row).select().single()
      if (insRes.data && pendingFiles.length > 0) {
        await uploadFilesForJob(insRes.data.id, pendingFiles)
      }
    }
    setUploading(false)
    setPendingFiles([])
    setForm(blank())
    showToast(editing ? 'Job updated' : 'Job saved')
    load()
  }

  async function togglePaid(job) {
    var newStatus = job.status === 'paid' ? 'unpaid' : 'paid'
    await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id)
    setJobs(function(prev) {
      return prev.map(function(j) {
        return j.id === job.id ? Object.assign({}, j, { status: newStatus }) : j
      })
    })
    showToast(newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid')
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job?')) return
    await supabase.from('jobs').delete().eq('id', id)
    setJobs(function(prev) { return prev.filter(function(j) { return j.id !== id }) })
    showToast('Deleted')
  }

  function editJob(j) {
    setEditing(j.id)
    setForm({
      job_number:     j.job_number || '',
      customer:       j.customer || '',
      location:       j.location || '',
      start_date:     j.start_date || today(),
      end_date:       j.end_date || '',
      invoice_amount: j.invoice_amount || '',
      materials:      j.materials || '',
      helper_days:    j.helper_days || '',
      helper_cost:    j.helper_cost || '',
      other_expenses: j.other_expenses || '',
      notes:          j.notes || '',
      status:         j.status || 'unpaid',
    })
    setPendingFiles([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showToast(m) {
    setToast(m)
    setTimeout(function() { setToast('') }, 2500)
  }

  function calcJob(j) {
    var costs = toNum(j.materials) + toNum(j.helper_cost) + toNum(j.other_expenses)
    var profit = toNum(j.invoice_amount) - costs
    var margin = toNum(j.invoice_amount) > 0 ? profit / toNum(j.invoice_amount) : 0
    return { costs: costs, profit: profit, margin: margin }
  }

  var filtered = filterStatus === 'all' ? jobs : jobs.filter(function(j) { return j.status === filterStatus })

  var totals = filtered.reduce(function(acc, j) {
    var c = calcJob(j)
    return { inv: acc.inv + toNum(j.invoice_amount), costs: acc.costs + c.costs, profit: acc.profit + c.profit }
  }, { inv: 0, costs: 0, profit: 0 })

  var unpaidTotal = jobs.filter(function(j) { return j.status !== 'paid' }).reduce(function(s,j) { return s + toNum(j.invoice_amount) }, 0)
  var paidTotal   = jobs.filter(function(j) { return j.status === 'paid' }).reduce(function(s,j) { return s + toNum(j.invoice_amount) }, 0)

  return (
    <Layout title="Jobs">
      <div className="page-header">
        <h2>Jobs</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <span><strong>{jobs.length}</strong> jobs</span>
          <span style={{ color: '#15803d' }}>Paid: <strong>{fmt(paidTotal)}</strong></span>
          <span style={{ color: '#b91c1c' }}>Unpaid: <strong>{fmt(unpaidTotal)}</strong></span>
        </div>
      </div>
      <div className="page-body">

        <div className="card">
          <div className="card-header">
            <h3>{editing ? 'Edit job' : 'New job'}</h3>
            {editing && (
              <button className="btn btn-sm" onClick={function() { setEditing(null); setForm(blank()); setPendingFiles([]) }}>Cancel</button>
            )}
          </div>
          <div className="card-body">
            <div className="form-grid">

              <div className="form-row">
                <div className="field">
                  <label>Job #</label>
                  <input type="text" value={form.job_number} onChange={setField('job_number')} placeholder="e.g. 1" />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>Customer *</label>
                  <input type="text" value={form.customer} onChange={setField('customer')} placeholder="Customer name" />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>Location</label>
                  <input type="text" value={form.location} onChange={setField('location')} placeholder="e.g. Royal Oak" />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={form.start_date} onChange={setField('start_date')} />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input type="date" value={form.end_date} onChange={setField('end_date')} />
                </div>
                <div className="field">
                  <label>Invoice amount ($)</label>
                  <input type="text" inputMode="decimal" value={form.invoice_amount} onChange={setField('invoice_amount')} placeholder="0.00" />
                </div>
                <div className="field">
                  <label>Payment status</label>
                  <select value={form.status} onChange={setField('status')}>
                    <option value="unpaid">Unpaid</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Materials ($)</label>
                  <input type="text" inputMode="decimal" value={form.materials} onChange={setField('materials')} placeholder="0.00" />
                </div>
                <div className="field">
                  <label>Helper days</label>
                  <input type="text" inputMode="decimal" value={form.helper_days} onChange={setField('helper_days')} placeholder="0" />
                </div>
                <div className="field">
                  <label>Helper cost ($)</label>
                  <input type="text" inputMode="decimal" value={form.helper_cost} onChange={setField('helper_cost')} placeholder="0.00" />
                </div>
                <div className="field">
                  <label>Other expenses ($)</label>
                  <input type="text" inputMode="decimal" value={form.other_expenses} onChange={setField('other_expenses')} placeholder="0.00" />
                </div>
              </div>

              <div className="field">
                <label>Notes</label>
                <input type="text" value={form.notes} onChange={setField('notes')} placeholder="Scope, materials, anything notable..." />
              </div>

              <div className="field">
                <label>Attachments (photos, contracts, invoices)</label>
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple onChange={onFileSelect} style={{ fontSize: 13 }} />
                {pendingFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pendingFiles.map(function(f, i) {
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--gray)', borderRadius: 20, fontSize: 12 }}>
                          <span>{f.name}</span>
                          <button onClick={function() { removePending(i) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, padding: 0 }}>x</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={save} disabled={uploading}>
                  {uploading ? 'Saving...' : editing ? 'Update job' : 'Save job'}
                </button>
                <button className="btn" onClick={function() { setForm(blank()); setEditing(null); setPendingFiles([]) }}>Clear</button>
              </div>

            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Job log</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'unpaid', 'invoiced', 'partial', 'paid'].map(function(s) {
                return (
                  <button key={s} className={'btn btn-sm' + (filterStatus === s ? ' btn-primary' : '')}
                    onClick={function() { setFilterStatus(s) }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No jobs yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Paid</th>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Dates</th>
                    <th className="text-right">Invoice</th>
                    <th className="text-right">Costs</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(function(j) {
                    var c = calcJob(j)
                    return (
                      <tr key={j.id} style={{ opacity: j.status === 'paid' ? 0.65 : 1 }}>
                        <td className="text-center">
                          <input type="checkbox" checked={j.status === 'paid'}
                            onChange={function() { togglePaid(j) }}
                            style={{ width: 'auto', cursor: 'pointer' }}
                            title="Mark as paid" />
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{j.job_number || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{j.customer}</td>
                        <td>{j.location}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {j.start_date}{j.end_date ? ' - ' + j.end_date : ''}
                        </td>
                        <td className="text-right mono">{fmt(j.invoice_amount)}</td>
                        <td className="text-right mono">{fmt(c.costs)}</td>
                        <td className="text-right mono" style={{ color: c.profit >= 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }}>{fmt(c.profit)}</td>
                        <td className="text-right">
                          <span className={'badge ' + (c.margin >= 0.35 ? 'badge-green' : c.margin >= 0.20 ? 'badge-yellow' : 'badge-red')}>
                            {fmtPct(c.margin)}
                          </span>
                        </td>
                        <td>
                          <span className={'badge ' + (
                            j.status === 'paid'     ? 'badge-green'  :
                            j.status === 'partial'  ? 'badge-yellow' :
                            j.status === 'invoiced' ? 'badge-blue'   :
                            'badge-red'
                          )}>
                            {j.status || 'unpaid'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm" onClick={function() { editJob(j) }}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={function() { deleteJob(j.id) }}>Del</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: 'var(--gray)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, fontSize: 12 }}>TOTALS</td>
                    <td className="text-right mono" style={{ fontWeight: 700 }}>{fmt(totals.inv)}</td>
                    <td className="text-right mono" style={{ fontWeight: 700 }}>{fmt(totals.costs)}</td>
                    <td className="text-right mono" style={{ fontWeight: 700, color: '#15803d' }}>{fmt(totals.profit)}</td>
                    <td className="text-right">
                      <span className="badge badge-green">
                        {totals.inv > 0 ? fmtPct(totals.profit / totals.inv) : '—'}
                      </span>
                    </td>
                    <td colSpan={2}></td>
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
