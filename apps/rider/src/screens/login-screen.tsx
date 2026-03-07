import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { logAppError } from '../lib/monitoring/error-log';

// Collects rider phone/password and initiates authenticated session flow.
export function LoginScreen() {
  const auth = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Performs rider login using phone/password and maps failures to UI-safe text.
  const handleLogin = async (): Promise<void> => {
    if (!phone.trim() || !password.trim()) {
      setErrorMessage('Phone and password are required');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await auth.login(phone.trim(), password);
    } catch (error: unknown) {
      logAppError('rider.login_failed', error, {
        feature: 'auth',
        operation: 'login',
        status: error instanceof ApiError ? error.status : undefined,
      });
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Rider Login</Text>
        <Text style={styles.subtitle}>
          Sign in with your rider phone and password.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+250700000001"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          onPress={() => void handleLogin()}
          style={[styles.button, isSubmitting ? styles.buttonDisabled : null]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0d7de',
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
