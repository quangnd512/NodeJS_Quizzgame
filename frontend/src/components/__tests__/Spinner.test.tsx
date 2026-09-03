import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Spinner from '../Spinner.js';

describe('Spinner', () => {
  it('render không crash', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeTruthy();
  });

  it('có aria-hidden="true"', () => {
    const { container } = render(<Spinner />);
    const span = container.querySelector('span.spinner');
    expect(span).toBeTruthy();
    expect(span?.getAttribute('aria-hidden')).toBe('true');
  });
});
