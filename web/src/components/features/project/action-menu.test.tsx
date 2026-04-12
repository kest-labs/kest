import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pencil, Trash2 } from 'lucide-react';
import { ActionMenu } from '@/components/features/project/action-menu';

describe('ActionMenu', () => {
  it('opens the menu and runs the selected callback', () => {
    const onRename = vi.fn();

    render(
      <ActionMenu
        ariaLabel="Open resource actions"
        items={[
          {
            key: 'rename',
            label: 'Rename',
            icon: Pencil,
            onSelect: onRename,
          },
        ]}
      />
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open resource actions' }));
    fireEvent.click(screen.getByText('Rename'));

    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('stops trigger propagation when requested', () => {
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ActionMenu
          ariaLabel="Open row actions"
          stopPropagation
          items={[
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
            },
          ]}
        />
      </div>
    );

    const trigger = screen.getByRole('button', { name: 'Open row actions' });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    expect(onParentClick).not.toHaveBeenCalled();
  });
});
