import { formatRM } from '../../shared/money.ts'
import type { QuoteBreakdown } from '../../shared/quote.ts'

/** Itemised price lines with subtotal, rush and total. */
export default function BreakdownTable({
  breakdown,
}: {
  breakdown: QuoteBreakdown
}) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Itemised price</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {breakdown.lines.map((line) => (
          <tr key={line.label}>
            <td className="py-2 pr-3 align-top">
              <div className="font-medium text-slate-800">{line.label}</div>
              {line.detail && (
                <div className="text-xs text-slate-500">{line.detail}</div>
              )}
            </td>
            <td className="py-2 text-right align-top tabular-nums">
              {formatRM(line.amountSen)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-slate-200">
          <th
            scope="row"
            className="py-2 pr-3 text-left font-normal text-slate-600"
          >
            Subtotal
          </th>
          <td className="py-2 text-right tabular-nums">
            {formatRM(breakdown.subtotalSen)}
          </td>
        </tr>
        {breakdown.rushSen > 0 && (
          <tr>
            <th
              scope="row"
              className="py-1 pr-3 text-left font-normal text-slate-600"
            >
              Rush (15%)
            </th>
            <td className="py-1 text-right tabular-nums">
              {formatRM(breakdown.rushSen)}
            </td>
          </tr>
        )}
        <tr className="border-t border-slate-300">
          <th scope="row" className="pt-3 text-left text-base font-semibold">
            Total
          </th>
          <td className="pt-3 text-right text-base font-semibold tabular-nums">
            {formatRM(breakdown.totalSen)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
