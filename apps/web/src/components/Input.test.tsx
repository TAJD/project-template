import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" name="email" />);

    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
  });

  it('associates the label with the input when neither id nor name is given', () => {
    render(<Input label="Email" />);

    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBeTruthy();
  });
});
