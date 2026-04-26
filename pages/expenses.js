import { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, normVendor, CAT_LIST, CAT_BADGE, catBadge } from '../lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

const SPECIAL_CATS = {
  'Owner Payroll (W-2)': {
    info: 'Auto-routes to S-Corp tracker as W-2 payroll. Updates your YTD salary paid.',
    type: 'payroll',
  },
  'Owner Distribution': {
    info: 'Auto-routes to S-Corp tracker as an owner distribution. Affects your tax planner.',
    type: 'distribution',
  },
}

const ALL_CATS = [...CAT_LIST, 'Owner Payroll (W-2)', 'Owner Distribution']

const CAT_BADGE_ALL = {
  ...CAT_BADGE,
  'Owner Payroll (W-2)': 'badge-purple',
  'Owner Distribution': 'badge-pink',
}

export default function Expenses() {
  const [txns, setTxns] = useState([])
  const [vendors, setVendors] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal] = useState(null)
  const [modalCat, setModalCat] = useState('')
  const [ddOpen, setDdOpen] = useState(false)
  const [ddItems, setDdItems] = useState([])
  const [autoAssigned, setAutoAssigned] = useState(false)
  const [form, setForm] = useState({
    date: today(), vendor: '', category: '', amount: '',
    method: 'Check', job_number: '', note: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [tRes, vRes] = await Promise.all([
      supabase.from('transactions').select('*')
        .in('type', ['expense', 'payroll', 'distribution'])
        .order('date', { ascending: false }),
      supabase.from('vendors').select('*')
    ])
    setTxns(tRes.data || [])
    const vm = {}
    ;(vRes.data || []).forEach(v => { vm[v.name_normalized] = { display: v.name_display, category: v.category } })
    setVendors(vm)
    setLoading(false)
  }

  function onVendorChange(val) {
    setForm(f => ({ ...f, vendor: val }))
    const norm = normVendor(val)
    if (vendors[norm]) {
      setForm(f => ({ ...f, category: vendors[norm].category }))
      setAutoAssigned(true)
    } else {
      if (autoAssigned) { setForm(f => ({ ...f, category: '' })); setAutoAssigned(false) }
    }
    const matches = Object.keys(vendors).filter(k => k.includes(norm) && norm.length > 0)
    setDdItems(matches)
    setDdOpen(matches.length > 0)
  }

  function selectDD(norm) {
    const v = vendors[norm]
    setForm(f => ({ ...f, vendor: v.display, category: v.category }))
    setAutoAssigned(true)
    setDdOpen(false)
  }

  async function saveNewVendor(norm, display, cat) {
    await supabase.from('vendors').upsert(
      { name_normalized: norm, name_display: display, category: cat },
      { onConflict: 'name_normalized' }
    )
    setVendors(prev => ({ ...prev, [norm]: { display, category: cat } }))
  }

  async function handleSave() {
    const { date, vendor, category, amount, method, job_number, note } = form
    if (!date || !vendor.trim() || !amount || Number(amount) <= 0) {
      alert('Please fill in date, vendor, and amount.'); return
    }
    const norm = normVendor(vendor)
    if (!category) {
      if (vendors[norm]) {
        await doSave({ ...form, category: vendors[norm].category })
      } else {
        setModal({ vendor: vendor.trim(), norm })
        setModalCat('')
      }
      return
    }
    if (!vendors[norm]) await saveNewVendor(norm, vendor.trim(), category)
    await doSave(form)
  }

  async function doSave(f) {
    const cat = f.category
    const special = SPECIAL_CATS[cat]
    const txnType = special ? special.type : 'expense'
    const amount = Number(f.amount)

    const { error } = await supabase.from('transactions').insert({
      date: f.date, vendor: f.vendor.trim(), category: cat,
      amount, method: f.method,
      job_number: f.job_number || null,
      note: f.note || null,
      type: txnType,
    })
    if (error) { alert('Error: ' + error.message); return }

    if (txnType === 'payroll') {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'ytd_payroll_paid').single()
      await supabase.from('settings').upsert(
        { key: 'ytd_payroll_paid', value: String(Number(s?.value || 0) + amount) },
        { onConflict: 'key' }
      )
    }

    showToast(
      txnType === 'payroll' ? 'Payroll saved — S-Corp & Tax Planner updated automatically' :
      txnType === 'distribution' ? 'Distribution saved — S-Corp tracker updated automatically' :
      'Transaction saved'
    )
    setForm({ date: today(), vendor: '', category: '', amount: '', method: 'Check', job_number: '', note: '' })
    setAutoAssigned(false)
    load()
  }

  async function confirmModal() {
    if (!modalCat) { alert('Select a category.'); return }
    const { vendor, norm } = modal
    await saveNewVendor(norm, vendor, modalCat)
    setModal(null)
    await doSave({ ...form, vendor, category: modalCat })
  }

  async function deleteTxn(id) {
    if (!confirm('Remove this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(prev => prev.filter(t => t.id !== id))
    showToast('Removed')
  }

  async function toggleCleared(id, current) {
    await supabase.from('transactions').update({ cleared: !current }).eq('id', id)
    setTxns(prev => prev.map(t => t.id === id ? { ...t, cleared: !current } : t))
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 3200) }

  const filtered = filterCat ? txns.filter(t => t.category === filterCat) : txns
  const total = filtered.reduce((s, t) => s + Number(t.amount), 0)
  const catTotals = {}
  txns.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount) })
  const specialInfo = SPECIAL_CATS[form.category]

  function exportCSV() {
    const rows = [['Date', 'Vendor', 'Category', 'Amount', 'Method', 'Job #', 'Note', 'Cleared']]
    filtered.forEach(t => rows.push([t.date, t.vendor, t.category, Number(t.amount).toFixed(2), t.method || '', t.job_number || '', t.note || '', t.cleared ? 'Yes' : 'No']))
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'FGT_Expenses.csv' })
    a.click()
  }

  return (
    <Layout title="Expenses">
      <div className="page-header">
        <h2>Expenses</h2>
        <button className="btn btn-sm" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="page-body">

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
              <span className={`badge ${CAT_BADGE_ALL[cat] || 'badge-gray'}`} style={{ marginRight: 6 }}>{cat}</span>
              <span className="mono" style={{ fontWeight: 600 }}>{fmt(amt)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>New transaction</h3>
            {autoAssigned && <span className="auto-tag">&#10003; Auto-assigned</span>}
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-row">
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Payment method</label>
                  <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {['Check', 'Credit card', 'Debit card', 'Cash', 'ACH / bank transfer', 'Payroll direct deposit'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>

              <div className="form-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Vendor / paid to</label>
                  <div className="ac-wrap">
                    <input type="text" value={form.vendor} placeholder="Start typing…"
                      onChange={e => onVendorChange(e.target.value)}
                      onFocus={() => { if (ddItems.length) setDdOpen(true) }}
                      onBlur={() => setTimeout(() => setDdOpen(false), 150)}
                      autoComplete="off"
                    />
                    {ddOpen && (
                      <div className="ac-dropdown" style={{ display: 'block' }}>
                        {ddItems.slice(0, 8).map(k => (
                          <div key={k} className="ac-item" onMouseDown={() => selectDD(k)}>
                            <span>{vendors[k]?.display}</span>
                            <span className="ac-cat">{vendors[k]?.category}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>Category {autoAssigned && <span className="auto-tag" style={{ marginLeft: 4 }}>auto</span>}</label>
                  <select value={form.category} onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setAutoAssigned(false) }}>
                    <option value="">— select —</option>
                    <optgroup label="Business expenses">
                      {CAT_LIST.map(c => <option key={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Owner (auto-routes to S-Corp + Tax Planner)">
                      <option>Owner Payroll (W-2)</option>
                      <option>Owner Distribution</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {specialInfo && (
                <div className="alert alert-info">
                  <strong>→ {form.category}:</strong> {specialInfo.info}
                </div>
              )}

              <div className="form-row">
                <div className="field">
                  <label>Job # (optional)</label>
                  <input type="text" placeholder="e.g. 12" value={form.job_number} onChange={e => setForm(f => ({ ...f, job_number: e.target.value }))} />
                </div>
                <div className="field" style={{ flex: 3 }}>
                  <label>Note (optional)</label>
                  <input type="text" placeholder="e.g. AquaDefense 1 gal, payroll check #204…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleSave}>Save transaction</button>
                <button className="btn" onClick={() => { setForm({ date: today(), vendor: '', category: '', amount: '', method: 'Check', job_number: '', note: '' }); setAutoAssigned(false) }}>Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Transactions {filtered.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>({filtered.length})</span>}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">All categories</option>
                {ALL_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
              {filterCat && <span style={{ fontSize: 13, fontWeight: 600 }}>Total: {fmt(total)}</span>}
            </div>
          </div>
          <div className="table-wrap">
            {loading
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
              : filtered.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transactions yet.</div>
                : (
                  <table>
                    <thead>
                      <tr>
                        <th title="Cleared in bank" style={{ width: 36 }}>Clr</th>
                        <th>Date</th><th>Vendor</th><th>Category</th><th>Note</th>
                        <th>Method</th><th>Job #</th><th className="text-right">Amount</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => (
                        <tr key={t.id} style={{ opacity: t.cleared ? 0.55 : 1 }}>
                          <td className="text-center">
                            <input type="checkbox" checked={!!t.cleared} onChange={() => toggleCleared(t.id, t.cleared)}
                              style={{ width: 'auto', cursor: 'pointer' }} title="Mark as cleared in bank statement" />
                          </td>
                          <td>{t.date}</td>
                          <td style={{ fontWeight: 500 }}>{t.vendor}</td>
                          <td>
                            <span className={`badge ${CAT_BADGE_ALL[t.category] || 'badge-gray'}`}>{t.category}</span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note}</td>
                          <td>{t.method}</td>
                          <td className="text-center">{t.job_number || '—'}</td>
                          <td className="text-right mono" style={{ fontWeight: 500 }}>{fmt(t.amount)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => deleteTxn(t.id)}>Remove</button></td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--gray)' }}>
                        <td colSpan={7} style={{ fontWeight: 600, fontSize: 12 }}>TOTAL</td>
                        <td className="text-right mono" style={{ fontWeight: 700 }}>{fmt(total)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )
            }
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <h3>First time seeing this vendor</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Pick a category for <strong>{modal.vendor}</strong> — remembered forever after this.
            </p>
            <div className="field">
              <label>Category</label>
              <select value={modalCat} onChange={e => setModalCat(e.target.value)}>
                <option value="">— select —</option>
                <optgroup label="Business expenses">
                  {CAT_LIST.map(c => <option key={c}>{c}</option>)}
                </optgroup>
                <optgroup label="Owner (auto-routes to S-Corp + Tax Planner)">
                  <option>Owner Payroll (W-2)</option>
                  <option>Owner Distribution</option>
                </optgroup>
              </select>
            </div>
            {SPECIAL_CATS[modalCat] && (
              <div className="alert alert-info" style={{ fontSize: 13 }}>{SPECIAL_CATS[modalCat].info}</div>
            )}
            <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmModal}>Save &amp; apply</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
