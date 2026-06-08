export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const content = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
