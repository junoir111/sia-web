// SIA: sidebar button to open "Le Mur".
import React from 'react';
import { Icon, Icons } from 'folds';
import { useMatch, useNavigate } from 'react-router-dom';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../components/sidebar';
import { SIA_WALL_PATH } from './paths';

export function SiaWallTab() {
  const navigate = useNavigate();
  const selected = !!useMatch({ path: SIA_WALL_PATH, caseSensitive: true, end: true });

  return (
    <SidebarItem active={selected}>
      <SidebarItemTooltip tooltip="Le Mur">
        {(triggerRef) => (
          <SidebarAvatar
            as="button"
            ref={triggerRef}
            outlined
            onClick={() => navigate(SIA_WALL_PATH)}
          >
            <Icon src={Icons.Bell} filled={selected} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
