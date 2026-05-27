import { describe, expect, it, vi } from 'vitest';
import { clearAuthFormDraft, readAuthFormDraft, writeAuthFormDraft } from './auth-form-draft';

function createStorage(initial: Record<string, string> = {}) {
  const state = { ...initial };

  return {
    getItem: vi.fn((key: string) => state[key] ?? null),
    removeItem: vi.fn((key: string) => {
      delete state[key];
    }),
    setItem: vi.fn((key: string, value: string) => {
      state[key] = value;
    }),
  };
}

describe('auth form draft storage', () => {
  it('hydrates a saved draft over the fallback shape', () => {
    const storage = createStorage({
      login: JSON.stringify({ username: 'stark', password: 'secret123' }),
    });

    expect(readAuthFormDraft(storage, 'login', { username: '', password: '' })).toEqual({
      username: 'stark',
      password: 'secret123',
    });
  });

  it('keeps fallback fields when the saved draft is partial', () => {
    const storage = createStorage({
      register: JSON.stringify({ username: 'stark' }),
    });

    expect(
      readAuthFormDraft(storage, 'register', {
        username: '',
        email: '',
        password: '',
      })
    ).toEqual({
      username: 'stark',
      email: '',
      password: '',
    });
  });

  it('falls back when the saved draft is invalid', () => {
    const storage = createStorage({ login: '{' });
    const fallback = { username: '', password: '' };

    expect(readAuthFormDraft(storage, 'login', fallback)).toBe(fallback);
  });

  it('writes and clears drafts', () => {
    const storage = createStorage();

    writeAuthFormDraft(storage, 'login', { username: 'stark', password: 'secret123' });
    expect(storage.setItem).toHaveBeenCalledWith(
      'login',
      JSON.stringify({ username: 'stark', password: 'secret123' })
    );

    clearAuthFormDraft(storage, 'login');
    expect(storage.removeItem).toHaveBeenCalledWith('login');
  });
});
