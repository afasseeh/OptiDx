import axios from 'axios';

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;

const api = axios.create({
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
  },
});

function ensureBlobDownload(filename, content, mimeType = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

async function request(method, url, data = undefined) {
  const response = await api.request({ method, url, data });
  return response.data;
}

function importJsonFile(onParsed) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? '{}'));
          onParsed?.(parsed);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

function comingSoon(label) {
  window.alert(`${label} is not connected yet.`);
}

window.OptiDxActions = {
  api,
  request,
  copyText,
  ensureBlobDownload,
  downloadJson(filename, data) {
    ensureBlobDownload(filename, JSON.stringify(data, null, 2), 'application/json');
  },
  downloadText(filename, text) {
    ensureBlobDownload(filename, text, 'text/plain;charset=utf-8');
  },
  importJsonFile,
  comingSoon,
};
