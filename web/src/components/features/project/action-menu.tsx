'use client';

import { useRouter } from 'next/navigation';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hidden?: boolean;
  external?: boolean;
  separatorBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
  align?: 'start' | 'center' | 'end';
  contentClassName?: string;
  stopPropagation?: boolean;
  triggerClassName?: string;
  triggerSize?: React.ComponentProps<typeof Button>['size'];
  triggerVariant?: React.ComponentProps<typeof Button>['variant'];
}

export function ActionMenu({
  items,
  ariaLabel = 'Open actions',
  align = 'end',
  contentClassName,
  stopPropagation = false,
  triggerClassName,
  triggerSize = 'sm',
  triggerVariant = 'ghost',
}: ActionMenuProps) {
  const router = useRouter();
  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) {
    return null;
  }

  const handleTriggerPropagation = (event: React.SyntheticEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  const handleItemSelect = (item: ActionMenuItem) => {
    if (item.disabled) {
      return;
    }

    if (item.href) {
      if (item.external) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
      } else {
        router.push(item.href);
      }
    }

    item.onSelect?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          isIcon
          aria-label={ariaLabel}
          className={cn('h-8 w-8 rounded-xl', triggerClassName)}
          onClick={handleTriggerPropagation}
          onPointerDown={handleTriggerPropagation}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn('w-48 rounded-xl', contentClassName)}>
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.key}>
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                disabled={item.disabled}
                variant={item.destructive ? 'destructive' : 'default'}
                onSelect={() => handleItemSelect(item)}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
