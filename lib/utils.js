import { useState } from 'react'

export const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

export const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`

export const normVendor = (v) => v.trim().toLowerCase()

export const CAT_LIST = [
  'Materials',
  'Tools & Equipment',
  'Truck & Gas',
  'Helper Pay',
  'Phone',
  'Insurance',
  'Licensing',
  'Shop Supplies',
  'Accounting & CPA',
  'Other',
]

export const CAT_BADGE = {
  'Materials':          'badge-blue',
  'Tools & Equipment':  'badge-orange',
  'Truck & Gas':        'badge-red',
  'Helper Pay':         'badge-green',
  'Phone':              'badge-teal',
  'Insurance':          'badge-yellow',
  'Licensing':          'badge-purple',
  'Shop Supplies':      'badge-pink',
  'Accounting & CPA':   'badge-teal',
  'IRS Tax Payment':    'badge-red',
  'State Tax Payment':  'badge-orange',
  'Other':              'badge-gray',
}

export function catBadge(cat) {
  return <span className={`badge ${CAT_BADGE[cat] || 'badge-gray'}`}>{cat}</span>
}

export function useToast() {
  const [msg, setMsg] = useState('')
  const show = (m) => setMsg(m)
  const clear = () => setMsg('')
  return { msg, show, clear }
}

export function calcTaxes(payrollPaid, passThrough, fedRate, stateRate) {
  var empSS        = payrollPaid * 0.062
  var empMed       = payrollPaid * 0.0145
  var bizSS        = payrollPaid * 0.062
  var bizMed       = payrollPaid * 0.0145
  var allFica      = empSS + empMed + bizSS + bizMed
  var qbi          = Math.max(passThrough * 0.20, 0)
  var taxableQBI   = Math.max(passThrough - qbi, 0)
  var fedOnPayroll = payrollPaid * fedRate
  var fedOnQBI     = taxableQBI * fedRate
  var stateTax     = (payrollPaid + taxableQBI) * stateRate
  var totalIncome  = fedOnPayroll + fedOnQBI + stateTax
  var grandTotal   = allFica + totalIncome
  return {
    empSS, empMed, bizSS, bizMed, allFica,
    qbi, taxableQBI,
    fedOnPayroll, fedOnQBI, stateTax,
    totalIncomeTax: totalIncome,
    grandTotal,
    quarterlyEst: fedOnQBI / 4,
  }
}
