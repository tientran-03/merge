import { Platform } from 'react-native';
export function pickInvoiceImageOnWeb(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0;width:1px;height:1px;';

    let settled = false;
    let safetyTimer: ReturnType<typeof window.setTimeout> | undefined;

    const finish = (uri: string | null) => {
      if (settled) return;
      settled = true;
      if (safetyTimer !== undefined) window.clearTimeout(safetyTimer);
      window.removeEventListener('focus', onWindowFocus);
      try {
        if (input.parentNode) input.parentNode.removeChild(input);
      } catch {
        /* ignore */
      }
      resolve(uri);
    };
    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (settled) return;
        if (!input.files || input.files.length === 0) {
          finish(null);
        }
      }, 400);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      finish(URL.createObjectURL(file));
    });

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus, { once: true });
    safetyTimer = window.setTimeout(() => finish(null), 120_000);

    input.click();
  });
}
