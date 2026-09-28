import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reglas del React Compiler: como aviso, para que un caso nuevo no frene una publicación.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      // Sólo aplica cuando el React Compiler está activo (no lo está en next.config): los useMemo manuales se mantienen.
      'react-hooks/preserve-manual-memoization': 'off',
      // Logos e íconos institucionales estáticos, con tamaño fijo: next/image no aporta y cambiaría cómo se dimensionan.
      '@next/next/no-img-element': 'off',
      // Parámetros o desestructuraciones descartadas a propósito se nombran con guion bajo.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
