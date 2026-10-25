import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/app/components/layout/app-layout';

vi.mock('react-router', () => ({
  Outlet: () => <div data-testid="outlet"></div>,
}));
vi.mock('@/app/components/layout/layout-header', () => ({
  LayoutHeader: () => <div data-testid="layout-header"></div>,
}));

describe('appLayout', () => {
  beforeEach(() => {
    render(<AppLayout />);
  });

  it('should render the outlet', () => {
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('should render the header', () => {
    expect(screen.getByTestId('layout-header')).toBeInTheDocument();
  });
});
