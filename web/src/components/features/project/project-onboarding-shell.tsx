'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpenText,
  Command,
  Globe,
  PlayCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PROJECT_WORKSPACE_MODULES, buildProjectWorkspaceRoute } from '@/components/features/project/project-navigation';
import { buildProjectDetailRoute, ROUTES } from '@/constants/routes';
import { useLocale } from '@/hooks/use-locale';
import { useProjects } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import { localeNames } from '@/i18n/config';
import { useOnboardingStore } from '@/store/onboarding-store';

const DOCS_URL = 'https://kest-docs.vercel.app';
const VIDEO_URL = 'https://www.youtube.com/results?search_query=kest+api+testing';
export const OPEN_COMMAND_PALETTE_EVENT = 'kest:open-command-palette';
export const OPEN_HELP_CENTER_EVENT = 'kest:open-help-center';

interface TourStep {
  id: string;
  title: string;
  description: string;
  selector: string;
}

const PROJECTS_PAGE_SIZE = 50;

export function ProjectOnboardingShell() {
  const t = useT('project');
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const projectsQuery = useProjects({ page: 1, perPage: PROJECTS_PAGE_SIZE });

  const hasCreatedFirstProject = useOnboardingStore.use.hasCreatedFirstProject();
  const hasCompletedTour = useOnboardingStore.use.hasCompletedTour();
  const markTourCompleted = useOnboardingStore.use.markTourCompleted();
  const markCommandPaletteHintSeen = useOnboardingStore.use.markCommandPaletteHintSeen();

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourLockSeconds, setTourLockSeconds] = useState(30);

  const currentProjectId = useMemo(() => {
    const match = pathname.match(/^\/project\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const projects = projectsQuery.data?.items ?? [];

  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        id: 'sidebar',
        title: t('onboardingTour.steps.sidebarTitle'),
        description: t('onboardingTour.steps.sidebarDescription'),
        selector: '[data-onboarding="project-list"]',
      },
      {
        id: 'create-project',
        title: t('onboardingTour.steps.createProjectTitle'),
        description: t('onboardingTour.steps.createProjectDescription'),
        selector: '[data-onboarding="create-project"]',
      },
      {
        id: 'demo-card',
        title: t('onboardingTour.steps.demoTitle'),
        description: t('onboardingTour.steps.demoDescription'),
        selector: '[data-onboarding="demo-project-card"]',
      },
      {
        id: 'help',
        title: t('onboardingTour.steps.helpTitle'),
        description: t('onboardingTour.steps.helpDescription'),
        selector: '[data-onboarding="help-button"]',
      },
      {
        id: 'command',
        title: t('onboardingTour.steps.commandTitle'),
        description: t('onboardingTour.steps.commandDescription'),
        selector: '[data-onboarding="command-palette"]',
      },
    ],
    [t]
  );

  useEffect(() => {
    const handleOpenCommandPalette = () => setIsCommandOpen(true);
    const handleOpenHelpCenter = () => setIsHelpOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === 'input' || tag === 'textarea' || Boolean(target?.isContentEditable);
      const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const isQuestionMark = event.key === '?' && !event.metaKey && !event.ctrlKey;
      const isProjectJump = event.key.toLowerCase() === 'p' && event.shiftKey === false;
      const isApiJump = event.key.toLowerCase() === 'a' && event.shiftKey === false;

      if (isMetaK) {
        event.preventDefault();
        setIsCommandOpen(true);
        markCommandPaletteHintSeen();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && (isProjectJump || isApiJump)) {
        return;
      }

      if (!isTypingTarget && event.key.toLowerCase() === 'g') {
        const followUpHandler = (followUpEvent: KeyboardEvent) => {
          if (followUpEvent.key.toLowerCase() === 'p') {
            router.push(ROUTES.CONSOLE.PROJECTS);
          } else if (followUpEvent.key.toLowerCase() === 'a' && currentProjectId) {
            router.push(buildProjectWorkspaceRoute(currentProjectId, 'api-specs'));
          }
          window.removeEventListener('keydown', followUpHandler, true);
        };

        window.addEventListener('keydown', followUpHandler, true);
        window.setTimeout(() => {
          window.removeEventListener('keydown', followUpHandler, true);
        }, 1200);
      }

      if (isQuestionMark) {
        if (isTypingTarget) {
          return;
        }
        event.preventDefault();
        setIsHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenCommandPalette);
    window.addEventListener(OPEN_HELP_CENTER_EVENT, handleOpenHelpCenter);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenCommandPalette);
      window.removeEventListener(OPEN_HELP_CENTER_EVENT, handleOpenHelpCenter);
    };
  }, [currentProjectId, markCommandPaletteHintSeen, router]);

  useEffect(() => {
    if (!hasCreatedFirstProject || hasCompletedTour) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsTourOpen(true);
      setTourStepIndex(0);
      setTourLockSeconds(30);
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasCompletedTour, hasCreatedFirstProject]);

  const currentTourStep = tourSteps[tourStepIndex] ?? tourSteps[0];
  const isTourLocked = tourLockSeconds > 0;

  useEffect(() => {
    if (!isTourOpen) {
      return;
    }

    const target = document.querySelector(currentTourStep.selector);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentTourStep, isTourOpen]);

  useEffect(() => {
    if (!isTourOpen || tourLockSeconds <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTourLockSeconds(current => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isTourOpen, tourLockSeconds]);

  const projectCommands = projects.map(project => ({
    id: `project-${project.id}`,
    title: project.name,
    subtitle: project.slug,
    icon: <Search className="h-4 w-4" />,
    onSelect: () => {
      router.push(buildProjectDetailRoute(project.id));
      setIsCommandOpen(false);
    },
  }));

  const workspaceCommands =
    currentProjectId !== null
      ? PROJECT_WORKSPACE_MODULES.filter(item => item.status === 'ready').map(item => ({
          id: `workspace-${item.value}`,
          title: t(`modules.${item.i18nKey}.label` as never),
          subtitle: t(`modules.${item.i18nKey}.description` as never),
          icon: <item.icon className="h-4 w-4" />,
          onSelect: () => {
            router.push(buildProjectWorkspaceRoute(currentProjectId, item.value));
            setIsCommandOpen(false);
          },
        }))
      : [];

  const utilityCommands = [
    {
      id: 'new-project',
      title: t('commandPalette.createProject'),
      subtitle: t('commandPalette.createProjectDescription'),
      icon: <Sparkles className="h-4 w-4" />,
      onSelect: () => {
        setIsCommandOpen(false);
        const button = document.querySelector('[data-onboarding="create-project"]') as HTMLButtonElement | null;
        button?.click();
      },
    },
    {
      id: 'switch-language',
      title: t('commandPalette.switchLanguage'),
      subtitle: t('commandPalette.switchLanguageDescription', {
        language: locale === 'zh-Hans' ? localeNames['en-US'] : localeNames['zh-Hans'],
      }),
      icon: <Globe className="h-4 w-4" />,
      onSelect: () => {
        setLocale(locale === 'zh-Hans' ? 'en-US' : 'zh-Hans');
        setIsCommandOpen(false);
      },
    },
    {
      id: 'open-docs',
      title: t('commandPalette.openDocs'),
      subtitle: DOCS_URL,
      icon: <BookOpenText className="h-4 w-4" />,
      onSelect: () => {
        window.open(DOCS_URL, '_blank', 'noopener,noreferrer');
        setIsCommandOpen(false);
      },
    },
  ];

  const filteredCommands = [...utilityCommands, ...projectCommands, ...workspaceCommands].filter(item => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return `${item.title} ${item.subtitle}`.toLowerCase().includes(query);
  });

  const closeTour = () => {
    setIsTourOpen(false);
    markTourCompleted();
  };

  return (
    <>
      <Dialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <DialogContent size="lg" hideCloseButton>
          <DialogHeader>
            <DialogTitle>{t('commandPalette.title')}</DialogTitle>
            <DialogDescription>{t('commandPalette.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <div className="relative">
              <Command className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                autoFocus
                value={commandQuery}
                onChange={event => setCommandQuery(event.target.value)}
                placeholder={t('commandPalette.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-text-muted">
                  {t('commandPalette.empty')}
                </div>
              ) : (
                filteredCommands.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onSelect}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-primary/5"
                  >
                    <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-main">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-text-muted">{item.subtitle}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('helpCenter.title')}</DialogTitle>
            <DialogDescription>{t('helpCenter.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-3">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-border/60 bg-background/80 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <BookOpenText className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">{t('helpCenter.docsTitle')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('helpCenter.docsDescription')}</p>
              </a>
              <a
                href={VIDEO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-border/60 bg-background/80 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <PlayCircle className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">{t('helpCenter.videoTitle')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('helpCenter.videoDescription')}</p>
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(false);
                  setIsCommandOpen(true);
                }}
                className="rounded-2xl border border-border/60 bg-background/80 p-4 text-left transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <Command className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">{t('helpCenter.commandTitle')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('helpCenter.commandDescription')}</p>
              </button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('helpCenter.shortcutsTitle')}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('helpCenter.shortcutsDescription')}</p>
                </div>
                <LanguageSwitcher />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <ShortcutRow label={t('helpCenter.shortcutCommandPalette')} keys="Cmd/Ctrl + K" />
                <ShortcutRow label={t('helpCenter.shortcutHelp')} keys="?" />
                <ShortcutRow label={t('helpCenter.shortcutProjects')} keys="G then P" />
                <ShortcutRow label={t('helpCenter.shortcutApiSpecs')} keys="G then A" />
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTourOpen}
        onOpenChange={open => {
          if (!open) {
            closeTour();
            return;
          }
          setIsTourOpen(true);
        }}
      >
        <DialogContent
          size="default"
          hideCloseButton
          onEscapeKeyDown={event => {
            if (isTourLocked) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={event => {
            if (isTourLocked) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('onboardingTour.title')}</DialogTitle>
            <DialogDescription>
              {t('onboardingTour.progress', {
                current: tourStepIndex + 1,
                total: tourSteps.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-text-main">{currentTourStep.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{currentTourStep.description}</p>
              {isTourLocked ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                  {t('onboardingTour.lockedCountdown', { seconds: tourLockSeconds })}
                </p>
              ) : null}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((tourStepIndex + 1) / tourSteps.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" onClick={closeTour} disabled={isTourLocked}>
                {t('onboardingTour.skip')}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTourStepIndex(index => Math.max(0, index - 1))}
                  disabled={tourStepIndex === 0}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (tourStepIndex >= tourSteps.length - 1) {
                      closeTour();
                      return;
                    }
                    setTourStepIndex(index => index + 1);
                  }}
                  disabled={tourStepIndex >= tourSteps.length - 1 && isTourLocked}
                >
                  {tourStepIndex >= tourSteps.length - 1
                    ? t('onboardingTour.finish')
                    : t('common.next')}
                </Button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <div className="sr-only">
        <Link href={ROUTES.CONSOLE.PROJECTS}>Projects</Link>
        <button type="button" data-onboarding="command-palette" onClick={() => setIsCommandOpen(true)}>
          Open command palette
        </button>
        <button type="button" data-onboarding="help-button" onClick={() => setIsHelpOpen(true)}>
          Open help
        </button>
      </div>
    </>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
      <span className="text-sm text-text-main">{label}</span>
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-text-muted">{keys}</span>
    </div>
  );
}
