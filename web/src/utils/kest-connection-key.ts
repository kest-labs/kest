interface KestConnectionKeyPayload {
  version: number;
  platform_url: string;
  platform_token: string;
  platform_project_id: string;
  platform_auto_sync_history: boolean;
}

export const buildKestConnectionKey = (payload: KestConnectionKeyPayload) => {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return `kest_key_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
};
