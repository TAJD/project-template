import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" name="email" />);

    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
  });
});
