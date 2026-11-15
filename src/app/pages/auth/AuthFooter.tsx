import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

// SIA: the source link stays visible (AGPL licence of Cinny).
export function AuthFooter() {
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text
        as="a"
        size="T300"
        href="https://github.com/junoir111/sia-web"
        target="_blank"
        rel="noreferrer"
      >
        SIA — code source libre
      </Text>
    </Box>
  );
}
