import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Card content</Card>);

    expect(screen.getByText('Card content')).toBeTruthy();
  });
});
