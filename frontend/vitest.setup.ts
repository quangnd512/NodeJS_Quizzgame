// Setup chung cho mọi test file cua frontend.
// Them cac matcher cua jest-dom (toBeInTheDocument, toHaveTextContent...)
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Don dep DOM sau moi test de cac test khong anh huong lan nhau
afterEach(() => {
  cleanup();
});
