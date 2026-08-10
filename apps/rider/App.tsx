// Intercept and suppress MetaMask and other browser extension injected runtime errors
if (typeof window !== 'undefined') {
  const originalErrorHandler = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || '');
    const src = String(source || '');
    if (
      msg.includes('MetaMask') ||
      msg.includes('extension') ||
      src.includes('chrome-extension://') ||
      (error && error.stack && error.stack.includes('chrome-extension://'))
    ) {
      return true; // Suppress the error
    }
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    if (reason) {
      const msg = String(reason.message || reason);
      const stack = String(reason.stack || '');
      if (
        msg.includes('MetaMask') ||
        msg.includes('extension') ||
        stack.includes('chrome-extension://')
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }
  }, true);
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/lib/auth/auth-context';
import { configureOnlineManager } from './src/lib/netinfo/online-manager';
import { RootNavigator } from './src/navigation/root-navigator';
import { theme } from './src/theme/tokens';

import { LanguageProvider } from './src/lib/i18n/language-context';

const linking: any = {
  prefixes: ['/'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotAccess: 'forgot-access',
          ResetAccess: 'reset-access',
          OtpHelp: 'otp-help',
        },
      },
      App: {
        screens: {
          Home: 'home',
          TripsStack: {
            path: 'trips',
            screens: {
              TripsList: '',
              TripDetail: 'detail/:tripId',
            },
          },
          SOS: 'sos',
          PoiNearby: 'nearby',
          Profile: 'profile',
        },
      },
    },
  },
};

// Synchronizes React Query request behavior with native connectivity state.
configureOnlineManager();

// Boots rider app providers (query/auth/navigation) for authenticated mobile flows.
export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: 1,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    }),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <NavigationContainer theme={navigationTheme} linking={linking}>
                <StatusBar style="light" />
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
