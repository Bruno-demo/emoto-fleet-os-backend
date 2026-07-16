/**
 * Utility to export data as a professionally formatted Excel spreadsheet (.xls)
 * using HTML SpreadsheetML format with inline CSS styling.
 */

export interface ExcelColumn {
  header: string;
  key: string;
  type?: 'text' | 'number' | 'currency' | 'status';
  align?: 'left' | 'center' | 'right';
}

export interface ExcelKPI {
  label: string;
  value: string;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface ExcelExportOptions {
  title: string;
  subtitle?: string;
  dateRange?: string;
  kpis?: ExcelKPI[];
  columns: ExcelColumn[];
  rows: Record<string, string | number | boolean | null | undefined>[];
  sheetName?: string;
}

export function downloadFormattedExcel({
  title,
  subtitle,
  dateRange,
  kpis,
  columns,
  rows,
  sheetName = 'Financial Report',
}: ExcelExportOptions) {
  // Styles for different cell roles
  const colors = {
    primary: '#1E3A8A', // Deep Blue
    primaryText: '#FFFFFF',
    zebra: '#F8FAFC',
    border: '#E2E8F0',
    metaBg: '#F1F5F9',
    successBg: '#DCFCE7',
    successText: '#15803D',
    warningBg: '#FEF9C3',
    warningText: '#A16207',
    dangerBg: '#FEE2E2',
    dangerText: '#B91C1C',
    infoBg: '#DBEAFE',
    infoText: '#1D4ED8',
    neutralBg: '#F1F5F9',
    neutralText: '#475569',
  };

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<!-- Sheet Name: ${sheetName} -->
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; }
  table { border-collapse: collapse; margin-bottom: 20px; }
  td, th { border: 1px solid ${colors.border}; padding: 8px 12px; font-size: 11pt; }
  .title-row { font-size: 16pt; font-weight: bold; color: ${colors.primary}; text-align: left; border: none; }
  .subtitle-row { font-size: 11pt; color: #64748B; text-align: left; border: none; }
  .meta-label { font-weight: bold; background-color: ${colors.metaBg}; text-align: left; }
  .meta-val { text-align: left; }
  .kpi-box { border: 2px solid ${colors.border}; background-color: ${colors.metaBg}; text-align: center; }
  .kpi-label { font-size: 9pt; color: #64748B; font-weight: bold; text-transform: uppercase; }
  .kpi-val { font-size: 14pt; font-weight: bold; color: ${colors.primary}; }
  
  /* Status styles */
  .status-paid { background-color: ${colors.successBg}; color: ${colors.successText}; font-weight: bold; text-align: center; }
  .status-partial { background-color: ${colors.warningBg}; color: ${colors.warningText}; font-weight: bold; text-align: center; }
  .status-overdue { background-color: ${colors.dangerBg}; color: ${colors.dangerText}; font-weight: bold; text-align: center; }
  .status-unpaid { background-color: ${colors.neutralBg}; color: ${colors.neutralText}; text-align: center; }
  .status-active { background-color: ${colors.infoBg}; color: ${colors.infoText}; font-weight: bold; text-align: center; }
  .status-delinquent { background-color: ${colors.dangerBg}; color: ${colors.dangerText}; font-weight: bold; text-align: center; }
  .status-paid_off { background-color: ${colors.successBg}; color: ${colors.successText}; font-weight: bold; text-align: center; }
  
  th.table-header { background-color: ${colors.primary}; color: ${colors.primaryText}; font-weight: bold; text-align: center; border: 1px solid #0F172A; }
  .total-row { font-weight: bold; background-color: ${colors.metaBg}; }
</style>
</head>
<body>
  <table>
    <!-- Header Block -->
    <tr>
      <td colspan="${columns.length}" class="title-row">${title}</td>
    </tr>
    ${subtitle ? `<tr><td colspan="${columns.length}" class="subtitle-row">${subtitle}</td></tr>` : ''}
    ${dateRange ? `<tr><td colspan="${columns.length}" class="subtitle-row"><b>Timeline:</b> ${dateRange}</td></tr>` : ''}
    <tr><td colspan="${columns.length}" style="border:none; height:10px;"></td></tr>
    
    <!-- Generation metadata -->
    <tr>
      <td class="meta-label">Export Date</td>
      <td class="meta-val" colspan="${columns.length - 1}">${new Date().toLocaleString()}</td>
    </tr>
    <tr><td colspan="${columns.length}" style="border:none; height:15px;"></td></tr>

    <!-- KPI Summary Block (if provided) -->
    ${kpis && kpis.length > 0 ? `
    <tr>
      <td colspan="${columns.length}" style="font-weight:bold; font-size:12pt; color:${colors.primary}; border:none;">Executive Summary KPI Dashboard</td>
    </tr>
    <tr>
      ${kpis.map(kpi => `
        <td colspan="${Math.max(1, Math.floor(columns.length / kpis.length))}" class="kpi-box">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-val">${kpi.value}</div>
        </td>
      `).join('')}
    </tr>
    <tr><td colspan="${columns.length}" style="border:none; height:20px;"></td></tr>
    ` : ''}

    <!-- Main Data Table -->
    <thead>
      <tr>
        ${columns.map(col => `<th class="table-header">${col.header}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, rIdx) => {
        const bgStyle = rIdx % 2 === 1 ? `style="background-color: ${colors.zebra};"` : '';
        return `
          <tr>
            ${columns.map(col => {
              const val = row[col.key];
              const align = col.align || (col.type === 'number' || col.type === 'currency' ? 'right' : col.align || 'left');
              
              if (col.type === 'status') {
                const statusStr = String(val).toUpperCase().replace(/ /g, '_');
                return `<td class="status-${statusStr.toLowerCase()}">${val}</td>`;
              }
              
              const formatStyle = align ? `align="${align}"` : '';
              const displayVal = col.type === 'currency' && typeof val === 'number'
                ? val.toLocaleString() + ' RWF'
                : val ?? '';
                
              return `<td ${bgStyle} ${formatStyle}>${displayVal}</td>`;
            }).join('')}
          </tr>
        `;
      }).join('')}
      
      <!-- Totals Row -->
      <tr class="total-row">
        ${columns.map((col, cIdx) => {
          if (cIdx === 0) return '<td>TOTAL</td>';
          
          if (col.type === 'currency' || col.type === 'number') {
            const sum = rows.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
            const displaySum = col.type === 'currency'
              ? sum.toLocaleString() + ' RWF'
              : sum.toLocaleString();
            return `<td align="right">${displaySum}</td>`;
          }
          
          return '<td></td>';
        }).join('')}
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.setAttribute('download', `${sanitizedTitle}_${new Date().toISOString().slice(0,10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
