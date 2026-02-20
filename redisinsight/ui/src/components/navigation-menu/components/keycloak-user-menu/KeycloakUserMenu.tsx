import cx from 'classnames'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { logoutFromKeycloak } from 'uiSrc/services/keycloakAuthService'
import { keycloakAuthSelector } from 'uiSrc/slices/auth/keycloak'
import { RiPopover } from 'uiSrc/components/base'
import { Spacer } from 'uiSrc/components/base/layout/spacer'
import { Title } from 'uiSrc/components/base/text/Title'
import { Text } from 'uiSrc/components/base/text'
import {
  SideBarItem,
  SideBarItemIcon,
} from 'uiSrc/components/base/layout/sidebar'
import { RiUserIcon } from 'uiSrc/components/base/icons/iconRegistry'
import styles from './styles.module.scss'

const KeycloakUserMenu = () => {
  const { user } = useSelector(keycloakAuthSelector)
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = () => {
    setIsOpen(false)
    logoutFromKeycloak()
  }

  const displayName = user?.preferredUsername || user?.email || user?.sub || ''

  const UserMenuButton = (
    <SideBarItem
      onClick={() => setIsOpen((v) => !v)}
      tooltipProps={{ text: 'User', placement: 'right' }}
      isActive={isOpen}
    >
      <SideBarItemIcon
        icon={RiUserIcon}
        aria-label="User Menu"
        data-testid="keycloak-user-menu-button"
      />
    </SideBarItem>
  )

  return (
    <RiPopover
      anchorPosition="rightUp"
      isOpen={isOpen}
      panelClassName={cx('popoverLikeTooltip', styles.popoverWrapper)}
      closePopover={() => setIsOpen(false)}
      button={UserMenuButton}
    >
      <div className={styles.popover} data-testid="keycloak-user-menu">
        <Title size="XS">User</Title>
        <Spacer size="s" />
        <div className={styles.userInfo}>
          {displayName && (
            <Text size="s" data-testid="keycloak-user-name">
              {displayName}
            </Text>
          )}
          {user?.email && user.email !== displayName && (
            <Text size="xs" color="subdued" data-testid="keycloak-user-email">
              {user.email}
            </Text>
          )}
        </div>
        <Spacer size="s" />
        <Text
          size="s"
          className={styles.logoutLink}
          onClick={handleLogout}
          data-testid="keycloak-logout-btn"
        >
          Sign out
        </Text>
      </div>
    </RiPopover>
  )
}

export default KeycloakUserMenu
