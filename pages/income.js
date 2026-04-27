import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Income() {
  var [txns, setTxns] = useState([])
  var [loading, setLoading] = useState(true)
  var [toast, setToast] = useState('')

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

  async function save() {
    if (!date || !customer.trim() || !amountReceived || parseFloat(amountReceived) <= 0) {
      alert('Date, customer name, and amount received are required.')
      return
    }
    var noteText = note || (amountInvoiced ? 'Invoiced: $' + parseFloat(amountInvoiced).toFixed(2) : null)
    var res = await supabase.from('transactions').insert({
      date: date,
      vendor: customer.trim(),
      category: 'Revenue',
      amount: parseFloat(amountReceived),
      method: method,
      job_number: jobNumber || null,
      note: noteText,
      type: 'income',
    })
    if (res.error) {
      alert('Error saving: ' + res.error.message)
      return
    }
    showToast('Payment recorded')
    setDate(today())
    setCustomer('')
    setAmountInvoiced('')
    setAmountReceived('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
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
    setTimeout(function() { setToast('') }, 2500)
  }

  function clearForm() {
    setDate(today())
    setCustomer('')
    setAmountInvoiced('')
    setAmountReceived('')
    setMethod('Check')
    setJobNumber('')
    setNote('')
  }

  function onMoneyInput(setter) {
    return function(e) {
      var val = e.target.value.replace(/[^0-9.]/g, '')
      setter(val)
    }
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
                  <input
                    type="date"
                    value={date}
                    onChange={function(e) { setDate(e.target.value) }}
                  />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>Customer name *</label>
                  <input
                    type="text"
                    value={customer}
                    placeholder="Customer name"
                    onChange={function(e) { setCustomer(e.target.value) }}
                  />
                </div>
                <div className="field">
                  <label>Job #</label>
                  <input
                    type="text"
                    value={jobNumber}
                    placeholder="optional"
                    onChange={function(e) { setJobNumber(e.target.value) }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Invoice amount ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountInvoiced}
                    placeholder="0.00"
                    onChange={onMoneyInput(setAmountInvoiced)}
                  />
                </div>
                <div className="field">
                  <label>Amount received ($) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountReceived}
                    placeholder="0.00"
                    onChange={onMoneyInput(setAmountReceived)}
                  />
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
                <input
                  type="text"
                  value={note}
                  placeholder="e.g. deposit, final payment, partial..."
                  onChange={function(e) { setNote(e.target.value) }}
                />
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
            {loading
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              : txns.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No payments recorded yet.</div>
                : (
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
                            <td className="text-center">{t.job_number || '—'}</td>
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
                )
            }
          </div>
        </div>

      </div>
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  )
}
