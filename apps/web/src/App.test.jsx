import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({})
      }))
    );
  });

  it('renders default listings tab', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Listings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
  });
});
