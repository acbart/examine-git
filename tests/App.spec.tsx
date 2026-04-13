import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

test('App renders workspace tabs', () => {
  render(<App />);
  expect(screen.getByText('Desktop')).toBeInTheDocument();
  expect(screen.getByText('GitHub')).toBeInTheDocument();
});
