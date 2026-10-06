// ============================================================
// Output PDF yang selamat untuk pelayar (Chrome + penyekat iklan)
// - Tiada lagi window.open(blob:...) → itu yang disekat (ERR_BLOCKED_BY_CLIENT)
// - Muat turun: <a download> dengan Blob (tiada navigasi)
// - Cetak: iframe tersembunyi + contentWindow.print(); jika disekat → muat turun
// ============================================================

/** Muat turun Blob sebagai fail (tanpa membuka tab baharu). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Cetak PDF melalui iframe tersembunyi dalam halaman yang sama.
 * Pulangkan true jika dialog cetak dibuka, false jika pelayar/penyekat menghalang
 * (pemanggil patut muat turun fail sebagai alternatif).
 */
export function printPdfBlob(blob: Blob): Promise<boolean> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px',
      border: '0', opacity: '0', pointerEvents: 'none',
    } as CSSStyleDeclaration);

    let settled = false;
    const cleanup = () => {
      // Biarkan iframe hidup seketika supaya dialog cetak tidak tertutup
      setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 60000);
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) { iframe.remove(); URL.revokeObjectURL(url); } else cleanup();
      resolve(ok);
    };

    iframe.onload = () => {
      // Beri masa sedikit untuk pemapar PDF dimuatkan
      setTimeout(() => {
        try {
          const w = iframe.contentWindow;
          if (!w) return finish(false);
          w.focus();
          w.print();          // halaman ralat (disekat) adalah cross-origin → akan 'throw'
          finish(true);
        } catch {
          finish(false);
        }
      }, 400);
    };
    iframe.onerror = () => finish(false);
    setTimeout(() => finish(false), 15000);   // had masa

    iframe.src = url;
    document.body.appendChild(iframe);
  });
}
