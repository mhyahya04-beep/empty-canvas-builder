import { RootRoute } from '@tanstack/react-router';

// Cast options to any to avoid strict type mismatch from generated route tree.
export const Route = new RootRoute({ id: '__root__' } as any);
