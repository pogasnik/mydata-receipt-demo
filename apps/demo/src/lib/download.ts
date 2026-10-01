/** Saves a Blob through a temporary object URL; nothing leaves the browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function documentFileName(doc: {
  documentType: string;
  series: string;
  aa: string;
}): string {
  const safe = (text: string) => text.replace(/[^\p{L}\p{N}_-]+/gu, '_');
  return `mydata-demo_${doc.documentType}_${safe(doc.series)}-${safe(doc.aa)}`;
}
