import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function Reconcile() {
  const [txns, setTxns] = useState([])
  const [settings, setSettings] = useState({ opening_balance: '0' })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [statementBalance, setStatementBalance] = useState('')
  const [statementDate, setStatementDate] = useState(today())
  const [openingBalance, setOpeningBalance] = useState('')
  const [filter, setFilter] = useState('all') // all | uncleared | cleared

  // Deposit form
  const [depForm, setDepForm] = useState({ date: today(), description: '', amount: '', method: 'Check', note: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const [tRes, sRes] = await Promise.all([
      supabase.from('transactions').select('*')
        .in('type', ['income', 'expense', 'payroll', 'distribution', 'deposit'])
        .order('date', { ascending: false }),
      supabase.from('settings').select('*'),
    ])
    setTxns(tRes.data || [])
    const sett = Object.fromEntries((sRes.data || []).map(r => [r.key, r.value]))
    setSettings(sett)
    setOpeningBalance(sett.opening_balance || '0')
    setLoading(false)
  }

  async function saveOpeningBalance() {
    await supabase.from('settings').upsert({ key: 'opening_balance', value: String(Number(openingBalance) || 0) }, { onConflict: 'key' })
    showToast('Opening balance saved')
  }

  async function addDeposit() {
    const { date, description, amount, method, note } = depForm
    if (!date || !description.trim() || !amount || Number(amount) <= 0) {
      alert('Date, description, and amount required.'); return
    }
    await supabase.from('transactions').insert({
      date, vendor: description.trim(), category: 'Deposit',
      amount: Number(amount), method, note: note || null, type: 'deposit'
    })
    setDepForm({ date: today(), description: '', amount: '', method: 'Check', note: '' })
    showToast('Deposit recorded')
    load()
  }

  async function toggleCleared(id, current) {
    await supabase.from('transactions').update({ cleared: !current }).eq('id', id)
    setTxns(prev => prev.map(t => t.id === id ? { ...t, cleared: !current } : t))
  }

  async function deleteDeposit(id) {
    if (!confirm('Remove this deposit?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTxns(prev => prev.filter(t => t.id !== id))
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500) }

  const opening = Number(settings.opening_balance) || 0

  // All money in (income + deposits = positive)
  // All money out (expenses + payroll + distributions = negative)
  const deposits = txns.filter(t => t.type === 'income' || t.type === 'deposit')
  const disbursements = txns.filter(t => ['expense', 'payroll', 'distribution'].includes(t.type))

  const totalDeposits = deposits.reduce((s, t) => s + Number(t.amount), 0)
  const totalDisbursements = disbursements.reduce((s, t) => s + Number(t.amount), 0)
  const booksBalance = opening + totalDeposits - totalDisbursements

  const clearedDeposits = deposits.filter(t => t.cleared).reduce((s, t) => s + Number(t.amount), 0)
  const clearedDisbursements = disbursements.filter(t => t.cleared).reduce((s, t) => s + Number(t.amount), 0)
  const clearedBalance = opening + clearedDeposits - clearedDisbursements

  const stmtBal = Number(statementBalance) || 0
  const difference = stmtBal - clearedBalance
  const isReconciled = statementBalance !== '' && Math.abs(difference) < 0.01

  const filtered = filter === 'cleared' ? txns.filter(t => t.cleared)
    : filter === 'uncleared' ? txns.filter(t => !t.cleared)
    : txns

  const typeLabel = (t) => {
    if (t.type === 'income') return { label: 'Payment in', dir: '+', color: '#15803d' }
    if (t.type === 'deposit') return { label: 'Deposit', dir: '+', color: '#15803d' }
    if (t.type === 'payroll') return { label: 'Payroll out', dir: '−', color: '#b91c1c' }
    if (t.type === 'distribution') return { label: 'Distribution out', dir: '−', color: '#b45309' }
    return { label: 'Expense out', dir: '−', color: '#374151' }
  }

  return (
    <Layout title="Reconcile">
      <div className="page-header">
        <h2>Bank Reconciliation</h2>
        {isReconciled && (
          <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ✓ Reconciled
          </span>
        )}
      </div>
      <div className="page-body">

        {/* Summary row */}
        <div className="metric-grid">
          <div className="card metric-card">
            <div className="label">Opening balance</div>
            <div className="value">{fmt(opening)}</div>
          </div>
          <div className="card metric-card metric-green">
            <div className="label">Total deposits / income</div>
            <div className="value">{fmt(totalDeposits)}</div>
          </div>
          <div className="card metric-card metric-red">
            <div className="label">Total disbursements</div>
            <div className="value">{fmt(totalDisbursements)}</div>
          </div>
          <div className="card metric-card metric-blue">
            <div className="label">Book balance</div>
            <div className="value">{fmt(booksBalance)}</div>
          </div>
        </div>

        {/* Reconcile panel */}
        <div className="card">
          <div className="card-header"><h3>Reconcile to bank statement</h3></div>
          <div className="card-body">
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="field">
                <label>Opening / starting balance ($)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
                  <button className="btn btn-sm" onClick={saveOpeningBalance}>Save</button>
                </div>
              </div>
              <div className="field">
                <label>Statement date</label>
                <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Bank statement ending balance ($)</label>
                <input type="number" step="0.01" placeholder="Enter from your bank statement"
                  value={statementBalance} onChange={e => setStatementBalance(e.target.value)} />
              </div>
            </div>

            {statementBalance !== '' && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--gray)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cleared balance (your books)</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(clearedBalance)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Check off transactions below as they appear on your statement</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--gray)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bank statement balance</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(stmtBal)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: isReconciled ? '#dcfce7' : '#fee2e2', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Difference</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: isReconciled ? '#15803d' : '#b91c1c' }}>{fmt(difference)}</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: isReconciled ? '#15803d' : '#b91c1c' }}>
                    {isReconciled ? '✓ Books match your bank statement' : 'Check off cleared transactions until this reaches $0.00'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add deposit */}
        <div className="card">
          <div className="card-header"><h3>Record deposit / money in</h3></div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 12 }}>
              Use this for non-revenue deposits: loan proceeds, owner contributions, transfers in, tax refunds, etc. Customer payments go on the Income page.
            </div>
            <div className="form-row">
              <div className="field">
                <label>Date</label>
                <input type="date" value={depForm.date} onChange={e => setDepForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Description</label>
                <input value={depForm.description} onChange={e => setDepForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Business loan, owner contribution…" />
              </div>
              <div className="field">
                <label>Amount ($)</label>
                <input type="number" step="0.01" min="0" value={depForm.amount} onChange={e => setDepForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="field">
                <label>Method</label>
                <select value={depForm.method} onChange={e => setDepForm(p => ({ ...p, method: e.target.value }))}>
                  {['Check', 'ACH / wire', 'Cash', 'Transfer'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label>&nbsp;</label>
                <button className="btn btn-primary" onClick={addDeposit}>Record deposit</button>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction ledger */}
        <div className="card">
          <div className="card-header">
            <h3>Full ledger</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'uncleared', 'cleared'].map(f => (
                <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            {loading
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
              : filtered.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transactions.</div>
                : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} title="Cleared in bank">Clr</th>
                        <th>Date</th><th>Description</th><th>Type</th>
                        <th className="text-right">Out (−)</th>
                        <th className="text-right">In (+)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => {
                        const { label, dir, color } = typeLabel(t)
                        const isIn = t.type === 'income' || t.type === 'deposit'
                        return (
                          <tr key={t.id} style={{ opacity: t.cleared ? 0.55 : 1 }}>
                            <td className="text-center">
                              <input type="checkbox" checked={!!t.cleared} onChange={() => toggleCleared(t.id, t.cleared)}
                                style={{ width: 'auto', cursor: 'pointer' }} />
                            </td>
                            <td>{t.date}</td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{t.vendor}</div>
                              {t.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.note}</div>}
                            </td>
                            <td><span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span></td>
                            <td className="text-right mono" style={{ color: '#b91c1c' }}>
                              {!isIn ? fmt(t.amount) : ''}
                            </td>
                            <td className="text-right mono" style={{ color: '#15803d', fontWeight: 500 }}>
                              {isIn ? fmt(t.amount) : ''}
                            </td>
                            <td>
                              {t.type === 'deposit' && (
                                <button className="btn btn-sm btn-danger" onClick={() => deleteDeposit(t.id)}>Remove</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
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
