import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

// `/project` legacy route.
// 作用：把旧 project 入口收敛到 Workspace-first shell。
export default function ProjectPage() {
  redirect(ROUTES.CONSOLE.PROJECTS);
}
