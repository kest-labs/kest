import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function ConsolePage() {
  redirect(ROUTES.CONSOLE.PROJECTS);
}
