import { createElement } from 'react';

import { useAuthSystem } from '@/auth/auth-context';

export function SignInButton(): React.JSX.Element {
  // The adapter's component is created once by createAuthSystem, not per render.
  return createElement(useAuthSystem().SignInButton);
}
