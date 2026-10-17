// A server-built .xlsx sent to the browser as base64; saved with a temporary link (client only).
export type XlsxFile = { name: string; base64: string };

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function downloadXlsx(file: XlsxFile) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX }));
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  a.click();
  URL.revokeObjectURL(url);
}
