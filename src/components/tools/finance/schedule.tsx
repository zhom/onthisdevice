import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CsvButton, DataTable, useMoney } from './common'
import type { Column } from './common'
import { aggregateByYear, csvMoney, formatMonthYear } from './money'
import { isoDate } from './calc-money-core'
import type { AmortResult, ScheduleRow, YearRow } from './money'

/**
 * The amortisation schedule shared by the mortgage, loan and car-loan tools:
 * a monthly view, a calendar-year roll-up, and a CSV of every payment.
 */
export function AmortizationSection({
  result,
  currency,
  filename,
  showExtra,
}: {
  result: AmortResult
  currency: string
  filename: string
  showExtra: boolean
}) {
  const money = useMoney(currency)
  const rows = result.rows
  const yearRows = aggregateByYear(rows)

  const monthlyColumns: Column<ScheduleRow>[] = [
    { key: 'n', header: '#', render: (r) => r.n },
    { key: 'date', header: 'Date', render: (r) => formatMonthYear(r.date) },
    { key: 'payment', header: 'Payment', align: 'right', render: (r) => money.exact(r.payment) },
    { key: 'principal', header: 'Principal', align: 'right', render: (r) => money.exact(r.principal) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    ...(showExtra
      ? [
          {
            key: 'extra',
            header: 'Extra',
            align: 'right' as const,
            render: (r: ScheduleRow) => (r.extra > 0 ? money.exact(r.extra) : '–'),
          },
        ]
      : []),
    {
      key: 'cumInterest',
      header: 'Interest to date',
      align: 'right',
      hideOnMobile: true,
      render: (r) => money.exact(r.cumInterest),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (r) => money.exact(r.balance) },
  ]

  const yearColumns: Column<YearRow>[] = [
    { key: 'year', header: 'Year', render: (r) => r.year },
    { key: 'payments', header: 'Payments', align: 'right', hideOnMobile: true, render: (r) => r.payments },
    { key: 'principal', header: 'Principal', align: 'right', render: (r) => money.exact(r.principal) },
    { key: 'interest', header: 'Interest', align: 'right', render: (r) => money.exact(r.interest) },
    ...(showExtra
      ? [
          {
            key: 'extra',
            header: 'Extra',
            align: 'right' as const,
            render: (r: YearRow) => (r.extra > 0 ? money.exact(r.extra) : '–'),
          },
        ]
      : []),
    {
      key: 'endingBalance',
      header: 'Ending balance',
      align: 'right',
      render: (r) => money.exact(r.endingBalance),
    },
  ]

  const csvHeaders = [
    'Payment #',
    'Date',
    'Payment',
    'Principal',
    'Interest',
    'Extra principal',
    'Cumulative interest',
    'Remaining balance',
  ]
  const csvRows = rows.map((r) => [
    r.n,
    isoDate(r.date),
    csvMoney(r.payment),
    csvMoney(r.principal),
    csvMoney(r.interest),
    csvMoney(r.extra),
    csvMoney(r.cumInterest),
    csvMoney(r.balance),
  ])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="monthly">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
          <CsvButton headers={csvHeaders} rows={csvRows} filename={filename} />
        </div>
        <TabsContent value="monthly" className="mt-4">
          <DataTable
            columns={monthlyColumns}
            rows={rows}
            pageSize={12}
            ariaLabel="Monthly amortisation schedule"
            emptyMessage="Enter a loan amount to build the schedule."
          />
        </TabsContent>
        <TabsContent value="yearly" className="mt-4">
          <DataTable
            columns={yearColumns}
            rows={yearRows}
            pageSize={15}
            ariaLabel="Yearly amortisation summary"
            emptyMessage="Enter a loan amount to build the schedule."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
