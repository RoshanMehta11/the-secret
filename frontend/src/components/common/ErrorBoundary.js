import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ marginTop: 12, color: '#f1f5f9' }}>Something went wrong</h2>
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748b' }}>
            An unexpected error occurred. Please try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '10px 24px',
              background: '#7c3aed', color: 'white',
              border: 'none', borderRadius: 8,
              fontWeight: 600, cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
