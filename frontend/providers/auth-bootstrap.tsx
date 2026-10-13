'use client';

import { useEffect } from 'react';
import { refreshSession } from '@/services/api-client';

/**
 * Restores the session on page load by exchanging the httpOnly refresh cookie for an access token.
 * Until it settles, auth status is "loading" and guarded pages render skeletons.
 */
export function AuthBootstrap() {
  useEffect(() => {
    void refreshSession();
  }, []);
  return null;
}
