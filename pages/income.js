import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0
  var n = parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

export default function Income() {
  var [txns, setTxns] = useState([])
  var [loading, setLoading] = useState(true)
  var [toast, setToast] = useState('')
  var [autoPaid, setAutoPaid] = useState(null)

  var [date, setDate] = useState(today())
  var [customer, setCustomer] = useState('')
  var [amountInvoiced, setAmountInvoiced] = useState('')
  var [amountReceived, setAmountReceived] = useState('')
  var [method, setMethod] = useState('Check')
  var [jobNumber, setJobNumber] = useState('')
  var [note, setNote] = useState('')

  useEffect(function() { load() }, [])

  async function load() {
    var res = await supabase.from('transactions').select('*')
      .eq('type', 'income')
      .order('date', { ascending: false })
    setTxns(res.data || [])
    setLoading(false)
  }

  async function onJobNumberChange(val) {
    setJobNumber(val)
    setAutoPaid(null)
    if (val.trim()) {
      var jRes = await supabase.from('jobs').select('*').eq('job_number', val.trim()).single()
      if (jRes.data) {
        setAutoPaid(jRes.data)
        if (!customer) setCustomer(jRes.data.customer)
        if (!amountInvoiced) setAmountInvoiced(String(jRes.data.invoice_amount || ''))
      }
    }
  }

  async function save() {
    var amt = toNum(amountReceived)
    if (!date) { alert('Please fill in the date.'); return }
    if (!customer.trim()) { alert('Please fill in the customer name.'); return }
    if (amt <= 0) { alert('Please enter a valid amount received.'); return }

    var noteText = note || (amountInvoiced ? 'Invoiced: $' + toNum(amountInvoiced).toFixed(2) : null)
    var res = await supabase.from('transactions').insert({
      date: date,
      vendor: customer.trim(),
      category: 'Revenue',
      amount: amt,
      method: method,
      job_number: jobNumber || null,
      note: noteText,
      type: 'income',
    })
    if (res.error) {
      alert('Error saving: ' + res.error.message)
      return
    }

    if (jobNumber.trim() && autoPaid) {
      await supabase.from('jobs').update({ status: 'paid' }).eq('id', autoPaid.id)
      showToast('Payment recorded — Job #' + jobNumber + ' automatically marked as paid')
    } else {
      showToast('Payment recorded')
    }

    setDate(today())
    setCustomer('')
    setAmountInvoiced('')
    setAmountReceived('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
    setAutoPaid(null)
    load()
  }

  async function deleteTxn(id) {
    if (!confirm('Remove this payment?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(function(prev) { return prev.filter(function(t) { return t.id !== id }) })
    showToast('Removed')
  }

  function showToast(m) {
    setToast(m)
    setTimeout(function() { setToast('') }, 3500)
  }

  function clearForm() {
    setDate(today())
    setCustomer('')
    setAmountInvoiced('')
    setAmountReceived('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
    setAutoPaid(null)
  }

  var totalReceived = txns.reduce(function(s, t) { return s + Number(t.amount) }, 0)

  function exportCSV() {
    var rows = [['Date', 'Customer', 'Job #', 'Method', 'Amount', 'Note']]
    txns.forEach(function(t) {
      rows.push([t.date, t.vendor, t.job_number || '', t.method || '', Number(t.amount).toFixed(2), t.note || ''])
    })
    var csv = rows.map(function(r) {
      return r.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"' }).join(',')
    }).join('\n')
    var a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'FGT_Income.csv'
    a.click()
  }

  return (
    <Layout title="Income">
      <div className="page-header">
        <h2>Income</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Total collected: {fmt(totalReceived)}</span>
          <button className="btn btn-sm" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>
      <div className="page-body">

        <div className="card">
          <div className="card-header"><h3>Record payment received</h3></div>
          <div className="card-body">
            <div className="form-grid">

              <div className="form-row">
                <div className="field">
                  <label>Date received *</label>
                  <input type="date" value={date} onChange={function(e) { setDate(e.target.value) }} />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>Customer name *</label>
                  <input type="text" value={customer} placeholder="Customer name"
                    onChange={function(e) { setCustomer(e.target.value) }} />
                </div>
                <div className="field">
                  <label>Job # (auto-marks paid)</label>
                  <input type="text" value={jobNumber} placeholder="e.g. 1"
                    onChange={function(e) { onJobNumberChange(e.target.value) }} />
                </div>
              </div>

              {autoPaid && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✓</span>
                  <span>Job #{jobNumber} found — <strong>{autoPaid.customer}</strong> for <strong>{fmt(autoPaid.invoice_amount)}</strong>. Saving this payment will automatically mark it as <strong>Paid</strong> on the dashboard and Job Log.</span>
                </div>
              )}

              <div className="form-row">
                <div className="field">
                  <label>Invoice amount ($)</label>
                  <input type="text" inputMode="decimal" value={amountInvoiced} placeholder="0.00"
                    onChange={function(e) { setAmountInvoiced(e.target.value) }} />
                </div>
                <div className="field">
                  <label>Amount received ($) *</label>
                  <input type="text" inputMode="decimal" value={amountReceived} placeholder="0.00"
                    onChange={function(e) { setAmountReceived(e.target.value) }} />
                </div>
                <div className="field">
                  <label>Payment method</label>
                  <select value={method} onChange={function(e) { setMethod(e.target.value) }}>
                    {['Check', 'Cash', 'Credit card', 'Zelle', 'Venmo', 'ACH'].map(function(m) {
                      return <option key={m}>{m}</option>
                    })}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Note (optional)</label>
                <input type="text" value={note} placeholder="e.g. deposit, final payment, partial..."
                  onChange={function(e) { setNote(e.target.value) }} />
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={save}>Save payment</button>
                <button className="btn" onClick={clearForm}>Clear</button>
              </div>

            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Payment history</h3></div>
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : txns.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No payments recorded yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Job #</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th className="text-right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(function(t) {
                    return (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td style={{ fontWeight: 500 }}>{t.vendor}</td>
                        <td className="text-center">{t.job_number ? '#' + t.job_number : '—'}</td>
                        <td>{t.method}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.note}</td>
                        <td className="text-right mono" style={{ fontWeight: 600, color: '#15803d' }}>{fmt(t.amount)}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={function() { deleteTxn(t.id) }}>Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: 'var(--gray)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, fontSize: 12 }}>TOTAL RECEIVED</td>
                    <td className="text-right mono" style={{ fontWeight: 700, color: '#15803d' }}>{fmt(totalReceived)}</td>
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
