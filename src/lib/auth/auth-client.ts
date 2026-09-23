'use client';

import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

// baseURL defaults to the current origin in the browser.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
