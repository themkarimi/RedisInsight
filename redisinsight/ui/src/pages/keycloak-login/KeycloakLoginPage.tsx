import React from 'react'
import { useSelector } from 'react-redux'
import { Redirect } from 'react-router-dom'
import { redirectToKeycloakLogin } from 'uiSrc/services/keycloakAuthService'
import { keycloakAuthSelector } from 'uiSrc/slices/auth/keycloak'
import { Col } from 'uiSrc/components/base/layout/flex'
import { PrimaryButton } from 'uiSrc/components/base/forms/buttons'
import { Title } from 'uiSrc/components/base/text/Title'
import { Text } from 'uiSrc/components/base/text'
import { RiIcon } from 'uiSrc/components/base/icons/RiIcon'
import styles from './styles.module.scss'

const KeycloakLoginPage = () => {
  const { isAuthenticated, error } = useSelector(keycloakAuthSelector)

  if (isAuthenticated) {
    return <Redirect to="/" />
  }

  const handleLogin = () => {
    redirectToKeycloakLogin()
  }

  return (
    <div className={styles.loginPage} data-testid="keycloak-login-page">
      <div className={styles.loginCard}>
        <Col align="center" gap="xl">
          <RiIcon
            className={styles.logoIcon}
            size="original"
            type="RedisLogoFullIcon"
          />
          <Title size="L">Sign in to RedisInsight</Title>
          {error && (
            <Text color="danger" data-testid="keycloak-login-error">
              {error}
            </Text>
          )}
          <PrimaryButton
            onClick={handleLogin}
            data-testid="keycloak-login-btn"
          >
            Sign in with SSO
          </PrimaryButton>
        </Col>
      </div>
    </div>
  )
}

export default KeycloakLoginPage
