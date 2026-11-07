import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImageProvider, ValImage, catalogAssets } from './images';
import type { Catalog, LibraryAdapter } from '../types';

const catalog: Catalog = { version: 'test', updatedAt: '', agents: [{ uuid: 'a', displayName: 'Sova', displayIcon: 'https://cdn/agent.png', roleIcon: 'https://cdn/role.png', abilities: [{ slot: 'Grenade', displayName: 'Recon', displayIcon: 'https://cdn/ability.png' }] }], maps: [{ uuid: 'm', displayName: 'Abyss', displayIcon: 'https://cdn/minimap.png', listViewIcon: 'https://cdn/map.png' }] };
function adapter(resolve: (url: string) => Promise<string>): LibraryAdapter {
  return { kind: 'tauri', catalog: async () => catalog, resolveImageUrl: resolve, reportImageError: async () => {}, mediaUrl: async (h: string) => h } as unknown as LibraryAdapter;
}
describe('image layer', () => {
  it('enumerates every catalog asset type without duplicates', () => { expect(catalogAssets(catalog).map(a => a.kind)).toEqual(['agent', 'role', 'ability', 'minimap', 'map']); });
  it('falls back to remote, retries once, then shows an explicit placeholder instead of a broken image', async () => {
    const resolve = vi.fn(async () => 'asset://localhost/cache/agent.png');
    const { container } = render(<ImageProvider adapter={adapter(resolve)}><ValImage src="https://cdn/agent.png" alt="Sova" kind="agent" /></ImageProvider>);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'asset://localhost/cache/agent.png'));
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/agent.png'));
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'asset://localhost/cache/agent.png'));
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Sova' })).toHaveAttribute('data-image-state', 'error'));
    expect(container.querySelector('img')).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
