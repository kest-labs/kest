import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function SettingsPage() {
  redirect(ROUTES.CONSOLE.PROFILE);
}
