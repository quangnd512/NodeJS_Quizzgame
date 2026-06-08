import { useEffect, useState } from 'react';
import './App.css';

// Kieu du lieu tra ve tu API /api/hello cua backend
interface HelloResponse {
  message: string;
  servedAt: string;
}

function App() {
  const [hello, setHello] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Goi sang backend de kiem tra ket noi Frontend <-> Backend
    const controller = new AbortController();

    async function fetchHello(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/hello', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Backend tra ve loi: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as HelloResponse;
        setHello(data);
      } catch (err) {
        // Bo qua loi do component bi huy (AbortController)
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const message = err instanceof Error ? err.message : 'Khong the ket noi den backend';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void fetchHello();

    return () => controller.abort();
  }, []);

  return (
    <main className="hello-page">
      <h1>QuizzGame – On thi THPT Quoc gia</h1>
      <p className="subtitle">Hello World – kiem tra ket noi Frontend &amp; Backend</p>

      {loading && <p>Dang ket noi den backend...</p>}

      {error && (
        <p className="error">
          Loi: {error}. Hay chac chan backend dang chay tai <code>http://localhost:4000</code>.
        </p>
      )}

      {hello && (
        <div className="hello-card">
          <p>{hello.message}</p>
          <small>Thoi gian phan hoi: {new Date(hello.servedAt).toLocaleString('vi-VN')}</small>
        </div>
      )}
    </main>
  );
}

export default App;
