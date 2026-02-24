import { useRef, type ChangeEvent } from 'react';
import { Copy, Download, Search, Upload } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useUiStore } from '../store/useUiStore';
import RippleButton from './RippleButton';

const HeroInput = () => {
  const { urlsInput, setUrlsInput, analyzeUrls } = useAppStore();
  const pushToast = useUiStore((state) => state.pushToast);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const copyUrls = async () => {
    if (!urlsInput.trim()) {
      pushToast('Nothing to copy', 'Paste at least one URL first.', 'info');
      return;
    }
    await navigator.clipboard.writeText(urlsInput);
    pushToast('Copied', 'URLs copied to clipboard.', 'success');
  };

  const exportUrls = () => {
    const text = urlsInput.trim();
    if (!text) {
      pushToast('Nothing to export', 'Paste at least one URL first.', 'info');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'urls.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importUrls = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const trimmed = text.trim();
      if (!trimmed) {
        pushToast('Import failed', 'Selected file is empty.', 'error');
        return;
      }
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (Array.isArray(parsed)) {
            setUrlsInput(parsed.map((item) => String(item)).join('\n'));
          } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { urls?: unknown[] }).urls)) {
            setUrlsInput(((parsed as { urls?: unknown[] }).urls || []).map((item) => String(item)).join('\n'));
          } else {
            setUrlsInput(trimmed);
          }
        } catch {
          setUrlsInput(trimmed);
        }
      } else {
        setUrlsInput(trimmed);
      }
      pushToast('Imported', `Loaded URLs from ${file.name}.`, 'success');
    } catch {
      pushToast('Import failed', 'Could not read that file.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="glass-card mt-6 rounded-card p-5">
      <label className="mb-2 block text-sm font-semibold text-slate-100">URLs</label>
      <textarea
        value={urlsInput}
        onChange={(event) => setUrlsInput(event.target.value)}
        placeholder="https://youtube.com/watch?v=..."
        rows={4}
        className="input-surface w-full resize-none text-sm"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.json"
        className="hidden"
        onChange={importUrls}
      />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <RippleButton variant="ghost" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Import
        </RippleButton>
        <RippleButton variant="ghost" onClick={exportUrls}>
          <Download className="h-4 w-4" />
          Export
        </RippleButton>
        <RippleButton variant="ghost" onClick={copyUrls}>
          <Copy className="h-4 w-4" />
          Copy URLs
        </RippleButton>
        <RippleButton onClick={analyzeUrls}>
          <Search className="h-4 w-4" />
          Analyze
        </RippleButton>
      </div>
    </section>
  );
};

export default HeroInput;
