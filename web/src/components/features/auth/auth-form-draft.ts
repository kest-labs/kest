export const LOGIN_FORM_DRAFT_KEY = 'kest.auth.login-form-draft.v1';
export const REGISTER_FORM_DRAFT_KEY = 'kest.auth.register-form-draft.v1';

export function readAuthFormDraft<TForm extends Record<string, unknown>>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  fallback: TForm
): TForm {
  try {
    const stored = storage.getItem(key);

    if (!stored) {
      return fallback;
    }

    const parsed = JSON.parse(stored);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }

    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

export function writeAuthFormDraft<TForm extends Record<string, unknown>>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  form: TForm
) {
  storage.setItem(key, JSON.stringify(form));
}

export function clearAuthFormDraft(storage: Pick<Storage, 'removeItem'>, key: string) {
  storage.removeItem(key);
}
