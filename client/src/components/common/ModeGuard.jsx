import React from 'react';
import Alert from 'react-bootstrap/Alert';
import { useTranslation } from 'react-i18next';
import useMode from '../../hooks/useMode';

/** <ModeGuard mode="research" setup={setup}>...</ModeGuard> */
export default function ModeGuard({ mode, setup, children }) {
  const { t } = useTranslation();
  const currentMode = useMode(setup);

  if (currentMode !== mode) {
    return (
      <Alert variant="warning">
        {t('common.noData')} {mode === 'research' ? 'This feature requires a Research Trial setup.' : 'This feature is only available in Farmer Mode.'}
      </Alert>
    );
  }

  return children;
}
