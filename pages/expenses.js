import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt, normVendor, CAT_LIST, CAT_BADGE, catBadge } from '../lib/utils'

function today() {
  return new Date().toISOString().slice(0, 10)
}

var SPECIAL_CATS = {
  'Owner Payroll (W-2)': {
    info: 'Auto-routes to S-Corp tracker as W-2 payroll. Updates your YTD salary paid.',
    type: 'payroll',
  },
  'Owner Distribution': {
    info: 'Auto-routes to S-Corp tracker as an owner distribution. Affects your tax planner.',
    type: 'distribution',
  },
}

var CAT_BADGE_ALL = Object.assign({}, CAT_BADGE, {
  'Owner Payroll (W-2)': 'badge-purple',
  'Owner Distribution':  'badge-pink',
  'IRS Tax Payment':     'badge-red',
  'State Tax Payment':   'badge-orange',
})

var ALL_CATS = CAT_LIST.concat([
  'Owner Payroll (W-2)',
  'Owner Distribution',
  'IRS Tax Payment',
  'State Tax Payment',
])

export default function Expenses() {
  var [txns, setTxns] = useState([])
  var [vendors, setVendors] = useState({})
  var [loading, setLoading] = useState(true)
  var [toast, setToast] = useState('')
  var [filterCat, setFilterCat] = useState('')
  var [modal, setModal] = useState(null)
  var [modalCat, setModalCat] = useState('')
  var [ddOpen, setDdOpen] = useState(false)
  var [ddItems, setDdItems] = useState([])
  var [autoAssigned, setAutoAssigned] = useState(false)

  var [date, setDate] = useState(today())
  var [vendor, setVendor] = useState('')
  var [category, setCategory] = useState('')
  var [amount, setAmount] = useState('')
  var [method, setMethod] = useState('Check')
  var [jobNumber, setJobNumber] = useState('')
  var [note, setNote] = useState('')

  useEffect(function() { load() }, [])

  async function load() {
    var tRes = await supabase.from('transactions').select('*')
      .in('type', ['expense', 'payroll', 'distribution'])
      .order('date', { ascending: false })
    var vRes = await supabase.from('vendors').select('*')
    setTxns(tRes.data || [])
    var vm = {}
    var vlist = vRes.data || []
    for (var i = 0; i < vlist.length; i++) {
      vm[vlist[i].name_normalized] = { display: vlist[i].name_display, category: vlist[i].category }
    }
    setVendors(vm)
    setLoading(false)
  }

  function onMoneyInput(e) {
    var val = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(val)
  }

  function onVendorChange(val) {
    setVendor(val)
    var norm = normVendor(val)
    if (vendors[norm]) {
      setCategory(vendors[norm].category)
      setAutoAssigned(true)
    } else {
      if (autoAssigned) {
        setCategory('')
        setAutoAssigned(false)
      }
    }
    if (norm.length > 0) {
      var matches = Object.keys(vendors).filter(function(k) { return k.indexOf(norm) !== -1 })
      setDdItems(matches)
      setDdOpen(matches.length > 0)
    } else {
      setDdOpen(false)
    }
  }

  function selectDD(norm) {
    setVendor(vendors[norm].display)
    setCategory(vendors[norm].category)
    setAutoAssigned(true)
    setDdOpen(false)
  }

  async function saveNewVendor(norm, display, cat) {
    await supabase.from('vendors').upsert(
      { name_normalized: norm, name_display: display, category: cat },
      { onConflict: 'name_normalized' }
    )
    setVendors(function(prev) {
      var next = Object.assign({}, prev)
      next[norm] = { display: display, category: cat }
      return next
    })
  }

  async function handleSave() {
    if (!date || !vendor.trim() || !amount || parseFloat(amount) <= 0) {
      alert('Please fill in date, vendor name, and amount.')
      return
    }
    var norm = normVendor(vendor)
    if (!category) {
      if (vendors[norm]) {
        await doSave(vendors[norm].category)
      } else {
        setModal({ vendor: vendor.trim(), norm: norm })
        setModalCat('')
      }
      return
    }
    if (!vendors[norm]) {
      await saveNewVendor(norm, vendor.trim(), category)
    }
    await doSave(category)
  }

  async function doSave(cat) {
    var special = SPECIAL_CATS[cat]
    var txnType = special ? special.type : 'expense'
    var amt = parseFloat(amount)

    var res = await supabase.from('transactions').insert({
      date: date,
      vendor: vendor.trim(),
      category: cat,
      amount: amt,
      method: method,
      job_number: jobNumber || null,
      note: note || null,
      type: txnType,
    })

    if (res.error) {
      alert('Error saving: ' + res.error.message)
      return
    }

    if (txnType === 'payroll') {
      var sRes = await supabase.from('settings').select('value').eq('key', 'ytd_payroll_paid').single()
      var current = Number((sRes.data && sRes.data.value) || 0)
      await supabase.from('settings').upsert(
        { key: 'ytd_payroll_paid', value: String(current + amt) },
        { onConflict: 'key' }
      )
    }

    var msg = txnType === 'payroll'       ? 'Payroll saved — S-Corp updated' :
              txnType === 'distribution'  ? 'Distribution saved — S-Corp updated' :
              cat === 'IRS Tax Payment'   ? 'IRS payment saved — Tax Planner updated' :
              cat === 'State Tax Payment' ? 'State payment saved — Tax Planner updated' :
              'Transaction saved'

    showToast(msg)
    setDate(today())
    setVendor('')
    setCategory('')
    setAmount('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
    setAutoAssigned(false)
    setDdOpen(false)
    load()
  }

  async function confirmModal() {
    if (!modalCat) { alert('Select a category.'); return }
    await saveNewVendor(modal.norm, modal.vendor, modalCat)
    setModal(null)
    setCategory(modalCat)
    await doSave(modalCat)
  }

  async function deleteTxn(id) {
    if (!confirm('Remove this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(function(prev) { return prev.filter(function(t) { return t.id !== id }) })
    showToast('Removed')
  }

  async function toggleCleared(id, current) {
    await supabase.from('transactions').update({ cleared: !current }).eq('id', id)
    setTxns(function(prev) {
      return prev.map(function(t) {
        return t.id === id ? Object.assign({}, t, { cleared: !current }) : t
      })
    })
  }

  function showToast(m) {
    setToast(m)
    setTimeout(function() { setToast('') }, 3200)
  }

  function clearForm() {
    setDate(today())
    setVendor('')
    setCategory('')
    setAmount('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
    setAutoAssigned(false)
    setDdOpen(false)
  }

  function exportCSV() {
    var rows = [['Date', 'Vendor', 'Category', 'Amount', 'Method', 'Job #', 'Note', 'Cleared']]
    var list = filterCat ? txns.filter(function(t) { return t.category === filterCat }) : txns
    list.forEach(function(t) {
      rows.push([t.date, t.vendor, t.category, Number(t.amount).toFixed(2), t.method || '', t.job_number || '', t.note || '', t.cleared ? 'Yes' : 'No'])
    })
    var csv = rows.map(function(r) {
      return r.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"' }).join(',')
    }).join('\n')
    var a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'FGT_Expenses.csv'
    a.click()
  }

  var filtered = filterCat ? txns.filter(function(t) { return t.category === filterCat }) : txns
  var total = filtered.reduce(function(s, t) { return s + Number(t.amount) }, 0)
  var catTotals = {}
  txns.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount)
  })
  var specialInfo = SPECIAL_CATS[category]

  return (
    <Layout title="Expenses">
      <div className="page-header">
        <h2>Expenses</h2>
        <button className="btn btn-sm" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="page-body">

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.keys(catTotals).sort(function(a,b) { return catTotals[b]-catTotals[a] }).map(function(cat) {
            return (
              <div key={cat} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                <span className={'badge ' + (CAT_BADGE_ALL[cat] || 'badge-gray')} style={{ marginRight: 6 }}>{cat}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{fmt(catTotals[cat])}</span>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>New transaction</h3>
            {autoAssigned && <span className="auto-tag">&#10003; Category auto-assigned</span>}
          </div>
          <div className="card-body">
            <div className="form-grid">

              <div className="form-row">
                <div className="field">
                  <label>Date *</label>
                  <input type="date" value={date} onChange={function(e) { setDate(e.target.value) }} />
                </div>
                <div className="field">
                  <label>Payment method</label>
                  <select value={method} onChange={function(e) { setMethod(e.target.value) }}>
                    {['Check', 'Credit card', 'Debit card', 'Cash', 'ACH / bank transfer', 'Payroll direct deposit'].map(function(m) {
                      return <option key={m}>{m}</option>
                    })}
                  </select>
                </div>
                <div className="field">
                  <label>Amount ($) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    placeholder="0.00"
                    onChange={onMoneyInput}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Vendor / paid to *</label>
                  <div className="ac-wrap">
                    <input
                      type="text"
                      value={vendor}
                      placeholder="Start typing vendor name..."
                      onChange={function(e) { onVendorChange(e.target.value) }}
                      onFocus={function() { if (ddItems.length > 0) setDdOpen(true) }}
                      onBlur={function() { setTimeout(function() { setDdOpen(false) }, 150) }}
                      autoComplete="off"
                    />
                    {ddOpen && (
                      <div className="ac-dropdown" style={{ display: 'block' }}>
                        {ddItems.slice(0, 8).map(function(k) {
                          return (
                            <div key={k} className="ac-item" onMouseDown={function() { selectDD(k) }}>
                              <span>{vendors[k] && vendors[k].display}</span>
                              <span className="ac-cat">{vendors[k] && vendors[k].category}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>
                    Category
                    {autoAssigned && <span className="auto-tag" style={{ marginLeft: 4 }}>auto</span>}
                  </label>
                  <select value={category} onChange={function(e) { setCategory(e.target.value); setAutoAssigned(false) }}>
                    <option value="">— select —</option>
                    <optgroup label="Business expenses">
                      {CAT_LIST.map(function(c) { return <option key={c}>{c}</option> })}
                    </optgroup>
                    <optgroup label="Owner (auto-routes to S-Corp + Tax Planner)">
                      <option>Owner Payroll (W-2)</option>
                      <option>Owner Distribution</option>
                    </optgroup>
                    <optgroup label="Tax payments (auto-routes to Tax Planner)">
                      <option>IRS Tax Payment</option>
                      <option>State Tax Payment</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {specialInfo && (
                <div className="alert alert-info">
                  <strong>→ {category}:</strong> {specialInfo.info}
                </div>
              )}

              {category === 'IRS Tax Payment' && (
                <div className="alert alert-info">
                  <strong>→ IRS Tax Payment:</strong> Automatically reduces your remaining IRS tax balance on the Dashboard and Tax Planner.
                </div>
              )}

              {category === 'State Tax Payment' && (
                <div className="alert alert-info">
                  <strong>→ State Tax Payment:</strong> Automatically reduces your remaining Michigan tax balance on the Dashboard and Tax Planner.
                </div>
              )}

              <div className="form-row">
                <div className="field">
                  <label>Job # (optional)</label>
                  <input type="text" placeholder="e.g. 12" value={jobNumber}
                    onChange={function(e) { setJobNumber(e.target.value) }} />
                </div>
                <div className="field" style={{ flex: 3 }}>
                  <label>Note (optional)</label>
                  <input type="text" placeholder="e.g. AquaDefense 1 gal, Q1 estimated tax payment..."
                    value={note} onChange={function(e) { setNote(e.target.value) }} />
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleSave}>Save transaction</button>
                <button className="btn" onClick={clearForm}>Clear</button>
              </div>

            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>
              Transactions
              {filtered.length > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>({filtered.length})</span>
              )}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} value={filterCat}
                onChange={function(e) { setFilterCat(e.target.value) }}>
                <option value="">All categories</option>
                {ALL_CATS.map(function(c) { return <option key={c}>{c}</option> })}
              </select>
              {filterCat && <span style={{ fontSize: 13, fontWeight: 600 }}>Total: {fmt(total)}</span>}
            </div>
          </div>
          <div className="table-wrap">
            {loading
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              : filtered.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transactions yet.</div>
                : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} title="Cleared in bank">Clr</th>
                        <th>Date</th>
                        <th>Vendor</th>
                        <th>Category</th>
                        <th>Note</th>
                        <th>Method</th>
                        <th>Job #</th>
                        <th className="text-right">Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(function(t) {
                        return (
                          <tr key={t.id} style={{ opacity: t.cleared ? 0.55 : 1 }}>
                            <td className="text-center">
                              <input type="checkbox" checked={!!t.cleared}
                                onChange={function() { toggleCleared(t.id, t.cleared) }}
                                style={{ width: 'auto', cursor: 'pointer' }}
                                title="Mark as cleared in bank statement" />
                            </td>
                            <td>{t.date}</td>
                            <td style={{ fontWeight: 500 }}>{t.vendor}</td>
                            <td>
                              <span className={'badge ' + (CAT_BADGE_ALL[t.category] || 'badge-gray')}>{t.category}</span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note}</td>
                            <td>{t.method}</td>
                            <td className="text-center">{t.job_number || '—'}</td>
                            <td className="text-right mono" style={{ fontWeight: 500 }}>{fmt(t.amount)}</td>
                            <td>
                              <button className="btn btn-sm btn-danger" onClick={function() { deleteTxn(t.id) }}>Remove</button>
                            </td>
                          </tr>
                        )
                      })}
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
        <div className="modal-overlay" onClick={function(e) { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal-box">
            <h3>First time seeing this vendor</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Pick a category for <strong>{modal.vendor}</strong> — remembered forever after this.
            </p>
            <div className="field">
              <label>Category</label>
              <select value={modalCat} onChange={function(e) { setModalCat(e.target.value) }}>
                <option value="">— select —</option>
                <optgroup label="Business expenses">
                  {CAT_LIST.map(function(c) { return <option key={c}>{c}</option> })}
                </optgroup>
                <optgroup label="Owner (auto-routes to S-Corp + Tax Planner)">
                  <option>Owner Payroll (W-2)</option>
                  <option>Owner Distribution</option>
                </optgroup>
                <optgroup label="Tax payments (auto-routes to Tax Planner)">
                  <option>IRS Tax Payment</option>
                  <option>State Tax Payment</option>
                </optgroup>
              </select>
            </div>
            {SPECIAL_CATS[modalCat] && (
              <div className="alert alert-info" style={{ fontSize: 13 }}>{SPECIAL_CATS[modalCat].info}</div>
            )}
            <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={function() { setModal(null) }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmModal}>Save &amp; apply</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
