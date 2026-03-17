import React, { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => console.error('Health check failed:', err));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🚀 Gastown Tester</h1>
      <p>Repository bootstrap and developer workflow foundation</p>

      <div style={{ marginTop: '2rem' }}>
        <h2>API Health Check</h2>
        {health ? (
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}

export default App;
