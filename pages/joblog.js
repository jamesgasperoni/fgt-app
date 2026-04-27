import { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, fmtPct } from '../lib/utils'

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0
  var n = parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

export default function JobLog() {
  var [jobs, setJobs] = useState([])
  var [loading, setLoading] = useState(true)
  var [selected, setSelected] = useState(null)
  var [attachments, setAttachments] = useState([])
  var [note, setNote] = useState('')
  var [savingNote, setSavingNote] = useState(false)
  var [uploading, setUploading] = useState(false)
  var [toast, setToast] = useState('')
  var [filter, setFilter] = useState('all')
  var fileRef = useRef()

  useEffect(function() { load() }, [])

  async function load() {
    var res = await supabase.from('jobs').select('*')
    var sorted = (res.data || []).sort(function(a, b) {
      var aNum = parseInt(a.job_number) || 0
      var bNum = parseInt(b.job_number) || 0
      return aNum - bNum
    })
    setJobs(sorted)
    setLoading(false)
  }

  async function openJob(job) {
    setSelected(job)
    setNote(job.notes || '')
    var aRes = await supabase.from('job_attachments').select('*').eq('job_id', job.id).order('created_at', { ascending: false })
    setAttachments(aRes.data || [])
  }

  async function saveNote() {
    if (!selected) return
    setSavingNote(true)
    await supabase.from('jobs').update({ notes: note }).eq('id', selected.id)
    setJobs(function(prev) {
      return prev.map(function(j) {
        return j.id === selected.id ? Object.assign({}, j, { notes: note }) : j
      })
    })
    setSelected(function(prev) { return Object.assign({}, prev, { notes: note }) })
    setSavingNote(false)
    showToast('Note saved')
  }

  async function uploadFile(e) {
    var file = e.target.files[0]
    if (!file || !selected) return
    setUploading(true)
    var fileName = Date.now() + '_' + file.name
    var path = 'job-' + selected.id + '/' + fileName
    var upRes = await supabase.storage.from('job-files').upload(path, file)
    if (upRes.error) {
      alert('Upload failed: ' + upRes.error.message)
      setUploading(false)
      return
    }
    var urlRes = supabase.storage.from('job-files').getPublicUrl(path)
    var fileUrl = urlRes.data.publicUrl
    await supabase.from('job_attachments').insert({
      job_id: selected.id,
      file_name: file.name,
      file_url: fileUrl,
      file_size: (file.size / 1024).toFixed(1) + ' KB',
      file_type: file.type,
    })
    var aRes = await supabase.from('job_attachments').select('*').eq('job_id', selected.id).order('created_at', { ascending: false })
    setAttachments(aRes.data || [])
    setUploading(false)
    showToast('File uploaded')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteAttachment(att) {
    if (!confirm('Remove this attachment?')) return
    var parts = att.file_url.split('/job-files/')
    if (parts[1]) await supabase.storage.from('job-files').remove([parts[1]])
    await supabase.from('job_attachments').delete().eq('id', att.id)
    setAttachments(function(prev) { return prev.filter(function(a) { return a.id !== att.id }) })
    showToast('Removed')
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

  var filtered = jobs.filter(function(j) {
    if (filter === 'all') return true
    if (filter === 'unpaid') return j.status !== 'paid'
    return j.status === filter
  })

  var sorted = filtered.slice().sort(function(a, b) {
    if (filter === 'all') {
      if (a.status !== 'paid' && b.status === 'paid') return -1
      if (a.status === 'paid' && b.status !== 'paid') return 1
    }
    var aNum = parseInt(a.job_number) || 0
    var bNum = parseInt(b.job_number) || 0
    return aNum - bNum
  })

  var unpaidCount = jobs.filter(function(j) { return j.status !== 'paid' }).length
  var paidCount   = jobs.filter(function(j) { return j.status === 'paid' }).length
  var unpaidTotal = jobs.filter(function(j) { return j.status !== 'paid' }).reduce(function(s,j) { return s + toNum(j.invoice_amount) }, 0)

  return (
    <Layout title="Job Log">
      <div className="page-header">
        <h2>Job Log</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, alignItems: 'center' }}>
          <span style={{ color: '#b91c1c', fontWeight: 600 }}>{unpaidCount} unpaid — {fmt(unpaidTotal)}</span>
          <span style={{ color: '#15803d', fontWeight: 600 }}>{paidCount} paid</span>
          <span style={{ color: 'var(--text-muted)' }}>{jobs.length} total</span>
        </div>
      </div>
      <div className="page-body">

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'unpaid', 'paid', 'partial', 'invoiced'].map(function(f) {
            return (
              <button key={f}
                className={'btn btn-sm' + (filter === f ? ' btn-primary' : '')}
                onClick={function() { setFilter(f); setSelected(null) }}>
                {f === 'all' ? 'All jobs' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'unpaid' && unpaidCount > 0 ? ' (' + unpaidCount + ')' : ''}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr', gap: 20 }}>

          <div className="card">
            <div className="card-header">
              <h3>{filter === 'all' ? 'All jobs' : filter.charAt(0).toUpperCase() + filter.slice(1) + ' jobs'}</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click any row to view details</span>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              ) : sorted.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No jobs found.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Job #</th>
                      <th>Customer</th>
                      <th>Location</th>
                      <th>Date</th>
                      <th className="text-right">Invoice</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(function(j) {
                      var isSelected = selected && selected.id === j.id
                      return (
                        <tr key={j.id}
                          onClick={function() { openJob(j) }}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? '#dbeafe' : undefined,
                            opacity: j.status === 'paid' ? 0.65 : 1,
                          }}>
                          <td style={{ fontWeight: 700, color: 'var(--blue)' }}>#{j.job_number || '—'}</td>
                          <td style={{ fontWeight: 500 }}>{j.customer}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{j.location}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{j.start_date}</td>
                          <td className="text-right mono">{fmt(j.invoice_amount)}</td>
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
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="card">
                <div className="card-header">
                  <div>
                    <h3>Job #{selected.job_number || '—'} — {selected.customer}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={'badge ' + (
                      selected.status === 'paid'     ? 'badge-green'  :
                      selected.status === 'partial'  ? 'badge-yellow' :
                      selected.status === 'invoiced' ? 'badge-blue'   :
                      'badge-red'
                    )}>
                      {selected.status || 'unpaid'}
                    </span>
                    <button className="btn btn-sm" onClick={function() { setSelected(null) }}>Close</button>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Job number',     value: '#' + (selected.job_number || '—') },
                      { label: 'Customer',       value: selected.customer },
                      { label: 'Location',       value: selected.location || '—' },
                      { label: 'Start date',     value: selected.start_date || '—' },
                      { label: 'End date',       value: selected.end_date || '—' },
                      { label: 'Invoice amount', value: fmt(selected.invoice_amount) },
                      { label: 'Materials',      value: fmt(selected.materials) },
                      { label: 'Helper days',    value: String(selected.helper_days || 0) },
                      { label: 'Helper cost',    value: fmt(selected.helper_cost) },
                      { label: 'Other expenses', value: fmt(selected.other_expenses) },
                    ].map(function(row) {
                      return (
                        <div key={row.label} style={{ padding: '8px 12px', background: 'var(--gray)', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.value}</div>
                        </div>
                      )
                    })}
                  </div>

                  {(function() {
                    var c = calcJob(selected)
                    return (
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div style={{ padding: '8px 12px', background: 'var(--gray)', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total costs</div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{fmt(c.costs)}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: c.profit >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Profit</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: c.profit >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(c.profit)}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'var(--gray)', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Margin</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: c.margin >= 0.35 ? '#15803d' : c.margin >= 0.20 ? '#b45309' : '#b91c1c' }}>{fmtPct(c.margin)}</div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3>Notes</h3></div>
                <div className="card-body">
                  <textarea
                    value={note}
                    onChange={function(e) { setNote(e.target.value) }}
                    placeholder="Add notes about this job — scope changes, customer feedback, materials used, anything..."
                    style={{ width: '100%', minHeight: 100, fontSize: 13 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={savingNote}>
                      {savingNote ? 'Saving...' : 'Save note'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Attachments</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Upload photos, invoices, contracts, or any other files
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={uploadFile}
                        style={{ fontSize: 13 }}
                        disabled={uploading}
                      />
                      {uploading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uploading...</span>}
                    </div>
                  </div>

                  {attachments.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No attachments yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {attachments.map(function(att) {
                        var isImage = att.file_type && att.file_type.includes('image')
                        return (
                          <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--gray)', borderRadius: 8 }}>
                            {isImage ? (
                              <img src={att.file_url} alt={att.file_name}
                                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                            ) : (
                              <div style={{ fontSize: 28, flexShrink: 0 }}>
                                {att.file_type && att.file_type.includes('pdf') ? '📋' :
                                 att.file_type && att.file_type.includes('word') ? '📝' : '📄'}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{att.file_size} · {new Date(att.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <a href={att.file_url} target="_blank" rel="noreferrer" className="btn btn-sm">View</a>
                              <button className="btn btn-sm btn-danger" onClick={function() { deleteAttachment(att) }}>Remove</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
