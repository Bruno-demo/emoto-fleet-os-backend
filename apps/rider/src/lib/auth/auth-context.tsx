import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../api/client';
import { loginResponseSchema, riderMeResponseSchema } from '../api/schemas';
import { logAppError } from '../monitoring/error-log';
import { clearAuthToken, readAuthToken, writeAuthToken } from './session';
import type { AuthUser, RiderMeResponse } from '../types/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
  riderMe: RiderMeResponse | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshRiderMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Provides rider authentication/session lifecycle and /rider/me hydration.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [riderMe, setRiderMe] = useState<RiderMeResponse | null>(null);

  // Hydrates auth state from secure storage and validates token with /rider/me.
  const bootstrapSession = useCallback(async (): Promise<void> => {
    setStatus('loading');
    const storedToken = await readAuthToken();

    if (!storedToken) {
      setToken(null);
      setUser(null);
      setRiderMe(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const me = await apiFetch('/rider/me', undefined, {
        schema: riderMeResponseSchema,
        token: storedToken,
      });

      setToken(storedToken);
      setUser((currentUser) =>
        currentUser
          ? currentUser
          : {
              id: me.userId,
              fleetId: me.fleetId,
              role: 'RIDER',
              email: me.email,
              phone: me.phone,
              status: 'ACTIVE',
            },
      );
      setRiderMe(me);
      setStatus('authenticated');
    } catch (error: unknown) {
      logAppError('auth.bootstrap_failed', error, {
        feature: 'auth',
        operation: 'bootstrapSession',
      });
      await clearAuthToken();
      setToken(null);
      setUser(null);
      setRiderMe(null);
      setStatus('unauthenticated');
    }
  }, []);

  // Executes rider login via phone/password and persists JWT on success.
  const login = useCallback(
    async (phone: string, password: string): Promise<void> => {
      try {
        const payload = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            phone,
            password,
          }),
        }, {
          auth: false,
          schema: loginResponseSchema,
        });

        // Backend sends OTP challenge when RIDER bypass is missing (stale build).
        if ('requireOtp' in payload && payload.requireOtp) {
          throw new Error(
            'Server requires OTP verification. Please contact support or try again later.',
          );
        }

        if (!('accessToken' in payload)) {
          throw new Error('Unexpected login response from server');
        }

        if (payload.user.role !== 'RIDER') {
          throw new Error('This account is not a rider account');
        }

        await writeAuthToken(payload.accessToken);
        const me = await apiFetch('/rider/me', undefined, {
          schema: riderMeResponseSchema,
          token: payload.accessToken,
        });

        setToken(payload.accessToken);
        setUser(payload.user);
        setRiderMe(me);
        setStatus('authenticated');
      } catch (error: unknown) {
        logAppError('auth.login_failed', error, {
          feature: 'auth',
          operation: 'login',
        });
        throw error;
      }
    },
    [],
  );

  // Clears secure session state and moves app back to the login flow.
  const logout = useCallback(async (): Promise<void> => {
    try {
      await clearAuthToken();
    } catch {
      // Ensure state is always cleared even if SecureStore fails.
    }
    setToken(null);
    setUser(null);
    setRiderMe(null);
    setStatus('unauthenticated');
  }, []);

  // Refreshes rider profile and active assignments after app actions.
  const refreshRiderMe = useCallback(async (): Promise<void> => {
    const storedToken = token ?? (await readAuthToken());
    if (!storedToken) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const me = await apiFetch('/rider/me', undefined, {
        schema: riderMeResponseSchema,
        token: storedToken,
      });

      setRiderMe(me);
      setToken(storedToken);
      setStatus('authenticated');
    } catch (error: unknown) {
      logAppError('auth.refresh_me_failed', error, {
        feature: 'auth',
        operation: 'refreshRiderMe',
      });
      throw error;
    }
  }, [token]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const contextValue = useMemo(
    () => ({
      status,
      token,
      user,
      riderMe,
      login,
      logout,
      refreshRiderMe,
    }),
    [status, token, user, riderMe, login, logout, refreshRiderMe],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Reads rider auth context and enforces provider usage.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
